-- packages/server/migrations/0020_snapshot_vault_audit_log.sql
-- Purpose:
--   Append-only audit log for operator actions related to snapshot vault operations.
--
-- Governance:
--   - Immutable (no UPDATE / DELETE)
--   - Durable
--   - Explicit writes only
--   - Survives restarts

BEGIN;

CREATE TABLE IF NOT EXISTS public.snapshot_vault_audit_log (
  audit_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What snapshot this action concerns
  snapshot_id     uuid NOT NULL,

  -- Action performed
  action          text NOT NULL CHECK (
                    action IN ('VAULT_EXPORT', 'VAULT_RESTORE')
                  ),

  -- Actor performing the action
  actor_id        text NOT NULL CHECK (length(actor_id) > 0),

  -- Optional integrity reference (e.g. payload hash)
  reference_hash  text,

  -- Free-form but explicit operator note
  note            text NOT NULL DEFAULT '',

  occurred_at     timestamptz NOT NULL DEFAULT now()
);

-- Indexes for audit review
CREATE INDEX IF NOT EXISTS idx_snapshot_vault_audit_snapshot
  ON public.snapshot_vault_audit_log(snapshot_id);

CREATE INDEX IF NOT EXISTS idx_snapshot_vault_audit_time
  ON public.snapshot_vault_audit_log(occurred_at);

-- Immutability enforcement
CREATE OR REPLACE FUNCTION public.trg_deny_update_delete_snapshot_vault_audit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'snapshot_vault_audit_log is append-only: % is not allowed', TG_OP
    USING ERRCODE = '28000';
END;
$$;

DROP TRIGGER IF EXISTS snapshot_vault_audit_deny_update
  ON public.snapshot_vault_audit_log;

CREATE TRIGGER snapshot_vault_audit_deny_update
BEFORE UPDATE ON public.snapshot_vault_audit_log
FOR EACH ROW
EXECUTE FUNCTION public.trg_deny_update_delete_snapshot_vault_audit();

DROP TRIGGER IF EXISTS snapshot_vault_audit_deny_delete
  ON public.snapshot_vault_audit_log;

CREATE TRIGGER snapshot_vault_audit_deny_delete
BEFORE DELETE ON public.snapshot_vault_audit_log
FOR EACH ROW
EXECUTE FUNCTION public.trg_deny_update_delete_snapshot_vault_audit();

COMMIT;
