-- packages/server/migrations/0016_ledger_append_only.sql
--
-- Week 16 (Step 5): Ledger table design & immutability triggers
--
-- Goals:
-- - Append-only persistence
-- - No UPDATE / DELETE
-- - Deterministic ordering support via explicit indexes
-- - Forward-compatible schema
--
-- Notes:
-- - checksum is nullable for now because the current server adapters
--   do not yet compute/persist deterministic SHA-256 checksums.
--   We will tighten this in a later step once adapters are upgraded.

BEGIN;

-- ---------------------------------------------------------------------
-- 1) Immutability enforcement function (ledger scope)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION forbid_ledger_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Ledger tables are append-only (UPDATE/DELETE forbidden).';
END;
$$;

-- ---------------------------------------------------------------------
-- 2) ledger_postings (append-only)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ledger_postings (
  id              UUID        NOT NULL,
  occurred_at      TIMESTAMPTZ NOT NULL,

  -- duplicated for query/index efficiency and determinism
  period_start     DATE        NOT NULL,
  period_end       DATE        NOT NULL,
  currency         TEXT        NOT NULL,
  reference_type   TEXT        NOT NULL,
  reference_id     TEXT        NOT NULL,

  payload          JSONB       NOT NULL,
  checksum         TEXT        NULL,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (id, created_at)
);

-- Immutability trigger: no updates/deletes
DROP TRIGGER IF EXISTS ledger_postings_no_update ON ledger_postings;
CREATE TRIGGER ledger_postings_no_update
BEFORE UPDATE OR DELETE ON ledger_postings
FOR EACH ROW
EXECUTE FUNCTION forbid_ledger_mutation();

-- Deterministic query performance
CREATE INDEX IF NOT EXISTS ledger_postings_occurred_at_idx
  ON ledger_postings (occurred_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS ledger_postings_period_idx
  ON ledger_postings (period_start, period_end, occurred_at DESC);

CREATE INDEX IF NOT EXISTS ledger_postings_reference_idx
  ON ledger_postings (reference_type, reference_id, occurred_at DESC);

-- ---------------------------------------------------------------------
-- 3) ledger_entries (append-only, read-optimized)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ledger_entries (
  id              UUID        NOT NULL,

  -- optional logical linkage to posting (no FK due to append-only multi-version PK)
  posting_id      UUID        NULL,

  occurred_at      TIMESTAMPTZ NOT NULL,

  -- duplicated for query/index efficiency and determinism
  period_start     DATE        NOT NULL,
  period_end       DATE        NOT NULL,
  account_code     TEXT        NOT NULL,
  side             TEXT        NOT NULL CHECK (side IN ('DEBIT', 'CREDIT')),
  amount           NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  currency         TEXT        NOT NULL,
  reference_type   TEXT        NOT NULL,
  reference_id     TEXT        NOT NULL,

  payload          JSONB       NOT NULL,
  checksum         TEXT        NULL,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (id, created_at)
);

-- Immutability trigger: no updates/deletes
DROP TRIGGER IF EXISTS ledger_entries_no_update ON ledger_entries;
CREATE TRIGGER ledger_entries_no_update
BEFORE UPDATE OR DELETE ON ledger_entries
FOR EACH ROW
EXECUTE FUNCTION forbid_ledger_mutation();

-- Deterministic query performance
CREATE INDEX IF NOT EXISTS ledger_entries_occurred_at_idx
  ON ledger_entries (occurred_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS ledger_entries_period_idx
  ON ledger_entries (period_start, period_end, occurred_at DESC);

CREATE INDEX IF NOT EXISTS ledger_entries_account_idx
  ON ledger_entries (account_code, occurred_at DESC);

CREATE INDEX IF NOT EXISTS ledger_entries_reference_idx
  ON ledger_entries (reference_type, reference_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS ledger_entries_posting_idx
  ON ledger_entries (posting_id, occurred_at DESC);

COMMIT;
