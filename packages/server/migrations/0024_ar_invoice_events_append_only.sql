-- packages/server/migrations/0024_ar_invoice_events_append_only.sql
-- Accounts Receivable — Invoice Events (Append-Only)
-- Phase 3: AR persistence foundation
--
-- Characteristics:
-- - Append-only
-- - Immutable
-- - Deterministic
-- - Audit-grade
-- - No projections yet (events only)

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1) AR invoice event log
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ar_invoice_events (
  event_id      UUID PRIMARY KEY,
  invoice_id    UUID NOT NULL,

  event_type    TEXT NOT NULL CHECK (event_type IN (
    'AR_INVOICE_CREATED',
    'AR_INVOICE_ISSUED',
    'AR_INVOICE_VOIDED'
  )),

  actor_id      TEXT NOT NULL,
  actor_roles   TEXT[] NOT NULL,

  reason        TEXT NOT NULL,
  event_time    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Domain payload (NO secrets)
  payload       JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ar_invoice_events_invoice
  ON ar_invoice_events(invoice_id);

CREATE INDEX IF NOT EXISTS idx_ar_invoice_events_time
  ON ar_invoice_events(event_time);

-- ─────────────────────────────────────────────────────────────
-- 2) Immutability enforcement
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION ar_invoice_events_immutable()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'ar_invoice_events is append-only and immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ar_invoice_events_no_update ON ar_invoice_events;
CREATE TRIGGER trg_ar_invoice_events_no_update
BEFORE UPDATE ON ar_invoice_events
FOR EACH ROW EXECUTE FUNCTION ar_invoice_events_immutable();

DROP TRIGGER IF EXISTS trg_ar_invoice_events_no_delete ON ar_invoice_events;
CREATE TRIGGER trg_ar_invoice_events_no_delete
BEFORE DELETE ON ar_invoice_events
FOR EACH ROW EXECUTE FUNCTION ar_invoice_events_immutable();

COMMIT;
