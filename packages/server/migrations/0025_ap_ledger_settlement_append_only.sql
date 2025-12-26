-- packages/server/migrations/0025_ap_ledger_settlement_append_only.sql
-- AP → LEDGER SETTLEMENT EVENTS (APPEND-ONLY EVENT STORE)
-- PHASE 7 — STEP 2
--
-- Guarantees:
-- - Append-only (NO UPDATE/DELETE)
-- - Idempotent writes via unique idempotency_key
-- - Deterministic querying via indexes
-- - Audit-safe payload storage + explicit journal payloads

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- TABLE
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ap_ledger_settlement_events (
  event_id                     uuid                     NOT NULL,
  settlement_id                uuid                     NOT NULL,
  event_type                   text                     NOT NULL,

  actor_id                     text                     NOT NULL,
  actor_roles                  text[]                   NOT NULL,

  reason                       text                     NOT NULL,
  idempotency_key              text                     NOT NULL,

  occurred_at                  timestamp with time zone NOT NULL,

  invoice_id                   uuid,
  payment_id                   uuid,
  supplier_id                  uuid,

  ledger_batch_id              uuid,
  original_settlement_event_id uuid,

  journal_json                 jsonb                    NOT NULL,
  reversal_journal_json        jsonb,

  payload_json                 jsonb                    NOT NULL,

  CONSTRAINT pk_ap_ledger_settlement_events PRIMARY KEY (event_id),

  CONSTRAINT chk_ap_ledger_settlement_event_type_nonempty
    CHECK (length(trim(event_type)) > 0),

  CONSTRAINT chk_ap_ledger_settlement_actor_id_nonempty
    CHECK (length(trim(actor_id)) > 0),

  CONSTRAINT chk_ap_ledger_settlement_reason_nonempty
    CHECK (length(trim(reason)) > 0),

  CONSTRAINT chk_ap_ledger_settlement_idempotency_key_nonempty
    CHECK (length(trim(idempotency_key)) > 0)
);

-- ─────────────────────────────────────────────────────────────
-- IDEMPOTENCY
-- ─────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS ux_ap_ledger_settlement_events_idempotency_key
  ON public.ap_ledger_settlement_events (idempotency_key);

-- ─────────────────────────────────────────────────────────────
-- DETERMINISTIC INDEXES (AUDIT TRACEABILITY)
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ap_ledger_settlement_events_settlement_id
  ON public.ap_ledger_settlement_events (settlement_id);

CREATE INDEX IF NOT EXISTS idx_ap_ledger_settlement_events_occurred_at
  ON public.ap_ledger_settlement_events (occurred_at);

CREATE INDEX IF NOT EXISTS idx_ap_ledger_settlement_events_invoice_id
  ON public.ap_ledger_settlement_events (invoice_id)
  WHERE invoice_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ap_ledger_settlement_events_payment_id
  ON public.ap_ledger_settlement_events (payment_id)
  WHERE payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ap_ledger_settlement_events_supplier_id
  ON public.ap_ledger_settlement_events (supplier_id)
  WHERE supplier_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ap_ledger_settlement_events_ledger_batch_id
  ON public.ap_ledger_settlement_events (ledger_batch_id)
  WHERE ledger_batch_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- APPEND-ONLY ENFORCEMENT
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_block_update_delete_ap_ledger_settlement_events()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'ap_ledger_settlement_events is append-only (UPDATE/DELETE forbidden)';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ap_ledger_settlement_events_block_update ON public.ap_ledger_settlement_events;
CREATE TRIGGER ap_ledger_settlement_events_block_update
BEFORE UPDATE ON public.ap_ledger_settlement_events
FOR EACH ROW
EXECUTE FUNCTION public.trg_block_update_delete_ap_ledger_settlement_events();

DROP TRIGGER IF EXISTS ap_ledger_settlement_events_block_delete ON public.ap_ledger_settlement_events;
CREATE TRIGGER ap_ledger_settlement_events_block_delete
BEFORE DELETE ON public.ap_ledger_settlement_events
FOR EACH ROW
EXECUTE FUNCTION public.trg_block_update_delete_ap_ledger_settlement_events();

COMMIT;
