-- packages/server/migrations/0023_snapshot_vault_deletion_workflow.sql
-- Purpose:
--   Two-person deletion authorization workflow for snapshot vault entries
--
-- Governance:
--   - Append-only
--   - No silent execution
--   - Explicit approvals required
--   - Legal-hold aware (enforced at service layer)

BEGIN;

CREATE TABLE IF NOT EXISTS public.snapshot_vault_deletion_request (
  request_id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id             uuid NOT NULL,
  requested_by_actor_id   text NOT NULL CHECK (length(requested_by_actor_id) > 0),
  requested_at            timestamptz NOT NULL DEFAULT now(),
  reason                  text NOT NULL CHECK (length(reason) > 0),
  executed_at             timestamptz
);

CREATE TABLE IF NOT EXISTS public.snapshot_vault_deletion_approval (
  approval_id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id              uuid NOT NULL
    REFERENCES public.snapshot_vault_deletion_request(request_id),
  approved_by_actor_id    text NOT NULL CHECK (length(approved_by_actor_id) > 0),
  approved_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_snapshot_vault_deletion_request_snapshot
  ON public.snapshot_vault_deletion_request(snapshot_id);

CREATE INDEX IF NOT EXISTS idx_snapshot_vault_deletion_approval_request
  ON public.snapshot_vault_deletion_approval(request_id);

-- Immutability enforcement
CREATE OR REPLACE FUNCTION public.trg_deny_update_delete_snapshot_vault_deletion()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'snapshot_vault_deletion_* tables are append-only';
END;
$$;

DROP TRIGGER IF EXISTS snapshot_vault_deletion_request_deny_update
  ON public.snapshot_vault_deletion_request;
CREATE TRIGGER snapshot_vault_deletion_request_deny_update
BEFORE UPDATE ON public.snapshot_vault_deletion_request
FOR EACH ROW EXECUTE FUNCTION public.trg_deny_update_delete_snapshot_vault_deletion();

DROP TRIGGER IF EXISTS snapshot_vault_deletion_request_deny_delete
  ON public.snapshot_vault_deletion_request;
CREATE TRIGGER snapshot_vault_deletion_request_deny_delete
BEFORE DELETE ON public.snapshot_vault_deletion_request
FOR EACH ROW EXECUTE FUNCTION public.trg_deny_update_delete_snapshot_vault_deletion();

DROP TRIGGER IF EXISTS snapshot_vault_deletion_approval_deny_update
  ON public.snapshot_vault_deletion_approval;
CREATE TRIGGER snapshot_vault_deletion_approval_deny_update
BEFORE UPDATE ON public.snapshot_vault_deletion_approval
FOR EACH ROW EXECUTE FUNCTION public.trg_deny_update_delete_snapshot_vault_deletion();

DROP TRIGGER IF EXISTS snapshot_vault_deletion_approval_deny_delete
  ON public.snapshot_vault_deletion_approval;
CREATE TRIGGER snapshot_vault_deletion_approval_deny_delete
BEFORE DELETE ON public.snapshot_vault_deletion_approval
FOR EACH ROW EXECUTE FUNCTION public.trg_deny_update_delete_snapshot_vault_deletion();

COMMIT;
