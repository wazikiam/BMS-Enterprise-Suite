-- packages/server/migrations/0019_reporting_snapshot_vault.sql
-- Purpose:
--   Durable, immutable vault archive for snapshot runtime payloads.
-- Governance:
--   - Vault writes are explicit (never automatic).
--   - Vault records are append-only and immutable.
--   - Runtime snapshot store may be cleared on restart (by design).
--   - Approved snapshots may exist without runtime payload; vault is optional but durable.

BEGIN;

-- 1) Vault table: stores a durable archive of the runtime payload for a snapshot.
--    This does NOT change governance approval rules; it is purely archival storage.
CREATE TABLE IF NOT EXISTS public.reporting_snapshot_vault (
  vault_id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id         uuid NOT NULL,

  -- Format is explicit to avoid ambiguity over time.
  -- 'json'  : payload_json column is used
  -- 'jsonb' : payload_jsonb column is used
  storage_format      text NOT NULL CHECK (storage_format IN ('json', 'jsonb')),

  -- Only one is expected to be populated based on storage_format.
  payload_json        json,
  payload_jsonb       jsonb,

  -- Hash of the canonical payload at time of vaulting (hex or base64 allowed).
  -- This is distinct from snapshot sealing hash; it proves vault integrity.
  payload_hash        text NOT NULL CHECK (length(payload_hash) >= 16),

  -- Size in bytes for operational visibility.
  size_bytes          integer NOT NULL CHECK (size_bytes >= 0),

  -- Operator / actor identity responsible for vaulting (audit).
  vaulted_by_actor_id text NOT NULL CHECK (length(vaulted_by_actor_id) > 0),

  vaulted_at          timestamptz NOT NULL DEFAULT now(),

  -- Optional human note (e.g., “exported before restart”, “vault import from file”).
  note                text NOT NULL DEFAULT ''
);

-- 2) FK: snapshot_id should refer to reporting_snapshots if it exists.
--    Use a DO block so this migration is resilient across branch histories.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM   information_schema.tables
    WHERE  table_schema = 'public'
    AND    table_name   = 'reporting_snapshots'
  ) THEN
    -- Add FK only if not already present
    IF NOT EXISTS (
      SELECT 1
      FROM   pg_constraint
      WHERE  conname = 'fk_reporting_snapshot_vault_snapshot'
    ) THEN
      ALTER TABLE public.reporting_snapshot_vault
        ADD CONSTRAINT fk_reporting_snapshot_vault_snapshot
        FOREIGN KEY (snapshot_id)
        REFERENCES public.reporting_snapshots(snapshot_id);
    END IF;
  END IF;
END $$;

-- 3) Indexes
CREATE INDEX IF NOT EXISTS idx_reporting_snapshot_vault_snapshot_id
  ON public.reporting_snapshot_vault(snapshot_id);

CREATE INDEX IF NOT EXISTS idx_reporting_snapshot_vault_vaulted_at
  ON public.reporting_snapshot_vault(vaulted_at);

-- 4) Immutability trigger (deny UPDATE/DELETE)
--    Enforces append-only archival behavior.
CREATE OR REPLACE FUNCTION public.trg_deny_update_delete_snapshot_vault()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'reporting_snapshot_vault is append-only: % is not allowed', TG_OP
    USING ERRCODE = '28000';
END;
$$;

DROP TRIGGER IF EXISTS reporting_snapshot_vault_deny_update ON public.reporting_snapshot_vault;
CREATE TRIGGER reporting_snapshot_vault_deny_update
BEFORE UPDATE ON public.reporting_snapshot_vault
FOR EACH ROW
EXECUTE FUNCTION public.trg_deny_update_delete_snapshot_vault();

DROP TRIGGER IF EXISTS reporting_snapshot_vault_deny_delete ON public.reporting_snapshot_vault;
CREATE TRIGGER reporting_snapshot_vault_deny_delete
BEFORE DELETE ON public.reporting_snapshot_vault
FOR EACH ROW
EXECUTE FUNCTION public.trg_deny_update_delete_snapshot_vault();

COMMIT;
