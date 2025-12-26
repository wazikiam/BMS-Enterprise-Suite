-- packages/server/migrations/0020_ar_payment_events_append_only.sql
-- AR PAYMENT EVENT STORE (IMMUTABLE, APPEND-ONLY)
-- Bank-grade Accounts Receivable payment system of record

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- AR Payment Events Table
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ar_payment_events (
    event_id            UUID PRIMARY KEY,
    payment_id          UUID NOT NULL,
    event_type          TEXT NOT NULL,
    occurred_at         TIMESTAMPTZ NOT NULL,
    recorded_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Monetary facts (deterministic, integer-based)
    amount_minor        BIGINT,
    currency            TEXT,

    -- Invoice linkage (apply / unapply only)
    invoice_id          UUID,

    -- Governance & audit
    actor_id            TEXT NOT NULL,
    actor_roles         TEXT[] NOT NULL,
    reason              TEXT NOT NULL,

    -- Integrity
    checksum            TEXT NOT NULL
);

-- ─────────────────────────────────────────────────────────────
-- HARD CONSTRAINTS
-- ─────────────────────────────────────────────────────────────

-- Amounts must be non-negative
ALTER TABLE public.ar_payment_events
ADD CONSTRAINT ar_payment_events_amount_non_negative
CHECK (
    amount_minor IS NULL OR amount_minor >= 0
);

-- Currency required when amount is present
ALTER TABLE public.ar_payment_events
ADD CONSTRAINT ar_payment_events_currency_required
CHECK (
    amount_minor IS NULL OR currency IS NOT NULL
);

-- ─────────────────────────────────────────────────────────────
-- IMMUTABILITY TRIGGERS
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION prevent_ar_payment_event_update()
RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'AR payment events are immutable and cannot be modified';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION prevent_ar_payment_event_delete()
RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'AR payment events are append-only and cannot be deleted';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ar_payment_events_no_update ON public.ar_payment_events;
CREATE TRIGGER ar_payment_events_no_update
BEFORE UPDATE ON public.ar_payment_events
FOR EACH ROW
EXECUTE FUNCTION prevent_ar_payment_event_update();

DROP TRIGGER IF EXISTS ar_payment_events_no_delete ON public.ar_payment_events;
CREATE TRIGGER ar_payment_events_no_delete
BEFORE DELETE ON public.ar_payment_events
FOR EACH ROW
EXECUTE FUNCTION prevent_ar_payment_event_delete();

-- ─────────────────────────────────────────────────────────────
-- PERFORMANCE INDEXES (AUDIT-SAFE)
-- ─────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_ar_payment_events_payment
    ON public.ar_payment_events (payment_id);

CREATE INDEX IF NOT EXISTS idx_ar_payment_events_invoice
    ON public.ar_payment_events (invoice_id);

CREATE INDEX IF NOT EXISTS idx_ar_payment_events_event_type
    ON public.ar_payment_events (event_type);

CREATE INDEX IF NOT EXISTS idx_ar_payment_events_occurred_at
    ON public.ar_payment_events (occurred_at);

COMMIT;
