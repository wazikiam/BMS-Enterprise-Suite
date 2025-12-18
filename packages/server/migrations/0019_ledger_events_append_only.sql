-- packages/server/migrations/0019_ledger_events_append_only.sql
-- LEDGER EVENT STORE (IMMUTABLE, APPEND-ONLY)
-- Bank-grade financial system of record

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- Ledger Events Table
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ledger_events (
    event_id            UUID PRIMARY KEY,
    journal_id          UUID NOT NULL,
    event_type          TEXT NOT NULL,
    occurred_at         TIMESTAMPTZ NOT NULL,
    recorded_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Accounting dimensions
    account_code        TEXT,
    debit_amount        NUMERIC(18, 6),
    credit_amount       NUMERIC(18, 6),
    currency            TEXT NOT NULL,

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

-- Exactly one of debit or credit may be set
ALTER TABLE public.ledger_events
ADD CONSTRAINT ledger_events_debit_credit_exclusive
CHECK (
    (debit_amount IS NOT NULL AND credit_amount IS NULL)
 OR (debit_amount IS NULL AND credit_amount IS NOT NULL)
 OR (debit_amount IS NULL AND credit_amount IS NULL)
);

-- Amounts must be non-negative
ALTER TABLE public.ledger_events
ADD CONSTRAINT ledger_events_amounts_non_negative
CHECK (
    (debit_amount IS NULL OR debit_amount >= 0)
AND (credit_amount IS NULL OR credit_amount >= 0)
);

-- ─────────────────────────────────────────────────────────────
-- IMMUTABILITY TRIGGERS
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION prevent_ledger_event_update()
RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Ledger events are immutable and cannot be modified';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION prevent_ledger_event_delete()
RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Ledger events are append-only and cannot be deleted';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ledger_events_no_update ON public.ledger_events;
CREATE TRIGGER ledger_events_no_update
BEFORE UPDATE ON public.ledger_events
FOR EACH ROW
EXECUTE FUNCTION prevent_ledger_event_update();

DROP TRIGGER IF EXISTS ledger_events_no_delete ON public.ledger_events;
CREATE TRIGGER ledger_events_no_delete
BEFORE DELETE ON public.ledger_events
FOR EACH ROW
EXECUTE FUNCTION prevent_ledger_event_delete();

-- ─────────────────────────────────────────────────────────────
-- PERFORMANCE INDEXES (READ-OPTIMIZED, AUDIT-SAFE)
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ledger_events_journal
    ON public.ledger_events (journal_id);

CREATE INDEX IF NOT EXISTS idx_ledger_events_account
    ON public.ledger_events (account_code);

CREATE INDEX IF NOT EXISTS idx_ledger_events_occurred_at
    ON public.ledger_events (occurred_at);

CREATE INDEX IF NOT EXISTS idx_ledger_events_event_type
    ON public.ledger_events (event_type);

COMMIT;
