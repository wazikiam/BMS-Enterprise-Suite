-- packages/server/migrations/0021_snapshot_vault_retention_policy.sql
-- Purpose:
--   Durable, explicit retention policy configuration for snapshot vault.
--
-- Governance:
--   - Policy is explicit (operator-set)
--   - No automatic deletion is enabled by this table alone
--   - Changes are append-only (history preserved)

BEGIN;

CREATE TABLE IF NOT EXISTS public.snapshot_vault_retention_policy (
  policy_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Policy name for operator clarity (e.g. "default", "year_end_close")
  name           text NOT NULL CHECK (length(name) > 0),

  -- Retention mode:
  -- 'INDEFINITE'      : keep forever
  -- 'AGE_DAYS'        : eligible if older than N days (for dry-run only unless deletion is separately authorized)
  retention_mode text NOT NULL CHECK (retention_mode IN ('INDEFINITE', 'AGE_DAYS')),

  -- Used only when retention_mode = 'AGE_DAYS'
  age_days       integer CHECK (age_days IS NULL OR age_days > 0),

  -- Operator attribution
  set_by_actor_id text NOT NULL CHECK (length(set_by_actor_id) > 0),
  set_at          timestamptz NOT NULL DEFAULT now(),

  -- Optional note
  note            text NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_snapshot_vault_retention_policy_name_setat
  ON public.snapshot_vault_retention_policy(name, set_at DESC);

-- Immutability (append-only)
CREATE OR REPLACE FUNCTION public.trg_deny_update_delete_retention_policy()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'snapshot_vault_retention_policy is append-only: % is not allowed', TG_OP
    USING ERRCODE = '28000';
END;
$$;

DROP TRIGGER IF EXISTS snapshot_vault_retention_policy_deny_update
  ON public.snapshot_vault_retention_policy;

CREATE TRIGGER snapshot_vault_retention_policy_deny_update
BEFORE UPDATE ON public.snapshot_vault_retention_policy
FOR EACH ROW
EXECUTE FUNCTION public.trg_deny_update_delete_retention_policy();

DROP TRIGGER IF EXISTS snapshot_vault_retention_policy_deny_delete
  ON public.snapshot_vault_retention_policy;

CREATE TRIGGER snapshot_vault_retention_policy_deny_delete
BEFORE DELETE ON public.snapshot_vault_retention_policy
FOR EACH ROW
EXECUTE FUNCTION public.trg_deny_update_delete_retention_policy();

COMMIT;
