-- packages/server/migrations/0022_ar_payment_events_v2_indexes.sql
-- AR PAYMENT EVENTS (V2) — INDEX FINALIZATION
-- Safe forward-only migration

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- Indexes for canonical AR payment events table
-- Use V2-specific names to avoid legacy collisions
-- ─────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_ar_payment_events_v2_payment
ON public.ar_payment_events (payment_id);

CREATE INDEX IF NOT EXISTS idx_ar_payment_events_v2_invoice
ON public.ar_payment_events (invoice_id);

CREATE INDEX IF NOT EXISTS idx_ar_payment_events_v2_event_type
ON public.ar_payment_events (event_type);

CREATE INDEX IF NOT EXISTS idx_ar_payment_events_v2_occurred_at
ON public.ar_payment_events (occurred_at);

COMMIT;
