-- packages/server/migrations/0022_snapshot_vault_legal_hold.sql
-- Purpose: Explicit legal holds on snapshot vault entries
-- Governance: append-only, durable

BEGIN;

CREATE TABLE IF NOT EXISTS public.snapshot_vault_legal_hold (
  legal_hold_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id          uuid NOT NULL,
  reason               text NOT NULL CHECK (length(reason) > 0),
  placed_by_actor_id   text NOT NULL CHECK (length(placed_by_actor_id) > 0),
  placed_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_snapshot_vault_legal_hold_snapshot
  ON public.snapshot_vault_legal_hold(snapshot_id);

CREATE OR REPLACE FUNCTION public.trg_deny_update_delete_legal_hold()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'snapshot_vault_legal_hold is append-only';
END;
$$;

DROP TRIGGER IF EXISTS snapshot_vault_legal_hold_deny_update
  ON public.snapshot_vault_legal_hold;
CREATE TRIGGER snapshot_vault_legal_hold_deny_update
BEFORE UPDATE ON public.snapshot_vault_legal_hold
FOR EACH ROW EXECUTE FUNCTION public.trg_deny_update_delete_legal_hold();

DROP TRIGGER IF EXISTS snapshot_vault_legal_hold_deny_delete
  ON public.snapshot_vault_legal_hold;
CREATE TRIGGER snapshot_vault_legal_hold_deny_delete
BEFORE DELETE ON public.snapshot_vault_legal_hold
FOR EACH ROW EXECUTE FUNCTION public.trg_deny_update_delete_legal_hold();

COMMIT;
