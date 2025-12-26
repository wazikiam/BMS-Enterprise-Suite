-- packages/server/migrations/0022_ar_ledger_settlement_append_only.sql
-- PHASE 5 — STEP 3
-- AR → LEDGER SETTLEMENT (APPEND-ONLY EVENT STORE)
--
-- Contract:
-- - Append-only event table (no updates, no deletes)
-- - Idempotency key stored for forensic traceability
-- - Deterministic ordering and queryability by invoice/payment
-- - PostgreSQL authoritative

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: ar_ledger_settlement_events
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ar_ledger_settlement_events (
  event_id          uuid        NOT NULL,
  settlement_id     uuid        NOT NULL,

  event_type        text        NOT NULL, -- e.g. AR_INVOICE_POSTED_TO_LEDGER, AR_PAYMENT_POSTED_TO_LEDGER, AR_LEDGER_POSTING_REVERSED

  -- Actor / governance
  actor_id          text        NOT NULL,
  actor_roles       text[]      NOT NULL,

  reason            text        NOT NULL,
  idempotency_key   text        NOT NULL,

  occurred_at       timestamptz NOT NULL,

  -- Links to AR facts (nullable by event type)
  invoice_id        uuid        NULL,
  payment_id        uuid        NULL,
  customer_id       uuid        NULL,

  -- Ledger reference (identifier only)
  ledger_batch_id   uuid        NULL,

  -- Original settlement event reference for reversals
  original_settlement_event_id uuid NULL,

  -- Deterministic journal payload (minor units, currency safe)
  journal_json      jsonb       NOT NULL,

  -- Deterministic reversal journal payload (for reversals)
  reversal_journal_json jsonb   NULL,

  -- Deterministic event payload envelope (optional future-proofing)
  payload_json      jsonb       NOT NULL,

  CONSTRAINT pk_ar_ledger_settlement_events PRIMARY KEY (event_id)
);

-- Basic sanity checks (non-exhaustive, enforcement is in application layer too)
ALTER TABLE public.ar_ledger_settlement_events
  ADD CONSTRAINT chk_ar_ledger_settlement_event_type_nonempty
  CHECK (length(trim(event_type)) > 0);

ALTER TABLE public.ar_ledger_settlement_events
  ADD CONSTRAINT chk_ar_ledger_settlement_actor_id_nonempty
  CHECK (length(trim(actor_id)) > 0);

ALTER TABLE public.ar_ledger_settlement_events
  ADD CONSTRAINT chk_ar_ledger_settlement_reason_nonempty
  CHECK (length(trim(reason)) > 0);

ALTER TABLE public.ar_ledger_settlement_events
  ADD CONSTRAINT chk_ar_ledger_settlement_idempotency_key_nonempty
  CHECK (length(trim(idempotency_key)) > 0);

-- ─────────────────────────────────────────────────────────────────────────────
-- IMMUTABILITY: APPEND-ONLY (no UPDATE, no DELETE)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_block_update_delete_ar_ledger_settlement_events()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'ar_ledger_settlement_events is append-only; % is not allowed', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ar_ledger_settlement_events_block_update ON public.ar_ledger_settlement_events;
CREATE TRIGGER ar_ledger_settlement_events_block_update
BEFORE UPDATE ON public.ar_ledger_settlement_events
FOR EACH ROW
EXECUTE FUNCTION public.trg_block_update_delete_ar_ledger_settlement_events();

DROP TRIGGER IF EXISTS ar_ledger_settlement_events_block_delete ON public.ar_ledger_settlement_events;
CREATE TRIGGER ar_ledger_settlement_events_block_delete
BEFORE DELETE ON public.ar_ledger_settlement_events
FOR EACH ROW
EXECUTE FUNCTION public.trg_block_update_delete_ar_ledger_settlement_events();

-- ─────────────────────────────────────────────────────────────────────────────
-- INDEXES (query + determinism)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ar_ledger_settlement_events_settlement_id
  ON public.ar_ledger_settlement_events (settlement_id);

CREATE INDEX IF NOT EXISTS idx_ar_ledger_settlement_events_occurred_at
  ON public.ar_ledger_settlement_events (occurred_at);

CREATE INDEX IF NOT EXISTS idx_ar_ledger_settlement_events_invoice_id
  ON public.ar_ledger_settlement_events (invoice_id)
  WHERE invoice_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ar_ledger_settlement_events_payment_id
  ON public.ar_ledger_settlement_events (payment_id)
  WHERE payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ar_ledger_settlement_events_customer_id
  ON public.ar_ledger_settlement_events (customer_id)
  WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ar_ledger_settlement_events_ledger_batch_id
  ON public.ar_ledger_settlement_events (ledger_batch_id)
  WHERE ledger_batch_id IS NOT NULL;

-- Idempotency: enforce uniqueness globally for settlement events.
-- (If your system uses a narrower scope, we can tighten later, but global is safest now.)
CREATE UNIQUE INDEX IF NOT EXISTS ux_ar_ledger_settlement_events_idempotency_key
  ON public.ar_ledger_settlement_events (idempotency_key);

COMMIT;
