-- packages/server/migrations/0025_ar_payment_events_append_only.sql
-- AR Payment Events (Append-Only, Audit-Grade)
-- Phase 5.2
--
-- Characteristics:
-- - Event-sourced
-- - Append-only (NO UPDATE / NO DELETE)
-- - Deterministic ordering
-- - Ledger-safe

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1) AR payment event store
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ar_payment_events (
  event_id        UUID PRIMARY KEY,
  payment_id      UUID NOT NULL,
  invoice_id      UUID NOT NULL,

  event_type      TEXT NOT NULL CHECK (event_type IN (
    'AR_PAYMENT_RECORDED',
    'AR_PAYMENT_REVERSED'
  )),

  amount          NUMERIC(18,6) NOT NULL CHECK (amount >= 0),
  currency        TEXT NOT NULL,

  occurred_at     TIMESTAMPTZ NOT NULL,
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  actor_id        TEXT NOT NULL,
  actor_roles     TEXT[] NOT NULL,

  reason          TEXT NOT NULL,
  checksum        TEXT NOT NULL
);

-- ─────────────────────────────────────────────────────────────
-- 2) Indexes (read-optimized)
-- ─────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_ar_payment_events_payment
  ON ar_payment_events(payment_id);

CREATE INDEX IF NOT EXISTS idx_ar_payment_events_invoice
  ON ar_payment_events(invoice_id);

CREATE INDEX IF NOT EXISTS idx_ar_payment_events_recorded_at
  ON ar_payment_events(recorded_at);

-- ─────────────────────────────────────────────────────────────
-- 3) Immutability enforcement
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION ar_payment_events_immutable()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'ar_payment_events is append-only and immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ar_payment_events_no_update ON ar_payment_events;
CREATE TRIGGER trg_ar_payment_events_no_update
BEFORE UPDATE ON ar_payment_events
FOR EACH ROW EXECUTE FUNCTION ar_payment_events_immutable();

DROP TRIGGER IF EXISTS trg_ar_payment_events_no_delete ON ar_payment_events;
CREATE TRIGGER trg_ar_payment_events_no_delete
BEFORE DELETE ON ar_payment_events
FOR EACH ROW EXECUTE FUNCTION ar_payment_events_immutable();

COMMIT;
