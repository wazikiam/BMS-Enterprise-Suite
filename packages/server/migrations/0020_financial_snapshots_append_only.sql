-- packages/server/migrations/0020_financial_snapshots_append_only.sql
-- FINANCIAL TRIAL BALANCE SNAPSHOTS — APPEND-ONLY, GOVERNED
--
-- Purpose:
-- - Persist deterministic financial snapshots
-- - Enforce immutability (no UPDATE / DELETE)
-- - Allow repeatable reads & audit verification
--
-- This table stores FINALIZED snapshots only.
-- Generation is governed by FinancialSnapshotCreationService.

BEGIN;

CREATE TABLE IF NOT EXISTS financial_trial_balance_snapshots (
  snapshot_id UUID PRIMARY KEY,
  kind TEXT NOT NULL,
  period_id UUID NOT NULL,

  period_from TIMESTAMPTZ NOT NULL,
  period_to   TIMESTAMPTZ NOT NULL,
  as_of       TIMESTAMPTZ NOT NULL,

  currency TEXT NOT NULL,

  balances JSONB NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  checksum TEXT NOT NULL,

  CONSTRAINT financial_tb_snapshot_kind_nonempty
    CHECK (length(trim(kind)) > 0),

  CONSTRAINT financial_tb_snapshot_currency_nonempty
    CHECK (length(trim(currency)) > 0),

  CONSTRAINT financial_tb_snapshot_checksum_nonempty
    CHECK (length(trim(checksum)) > 0)
);

-- Indexes for reporting & audit lookup
CREATE INDEX IF NOT EXISTS idx_fin_tb_snapshots_period
  ON financial_trial_balance_snapshots (period_id);

CREATE INDEX IF NOT EXISTS idx_fin_tb_snapshots_as_of
  ON financial_trial_balance_snapshots (as_of);

CREATE INDEX IF NOT EXISTS idx_fin_tb_snapshots_created_at
  ON financial_trial_balance_snapshots (created_at);

-- Immutability enforcement
CREATE OR REPLACE FUNCTION prevent_financial_tb_snapshot_update()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'financial_trial_balance_snapshots is append-only: UPDATE is forbidden';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION prevent_financial_tb_snapshot_delete()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'financial_trial_balance_snapshots is append-only: DELETE is forbidden';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS financial_tb_snapshots_no_update
  ON financial_trial_balance_snapshots;

DROP TRIGGER IF EXISTS financial_tb_snapshots_no_delete
  ON financial_trial_balance_snapshots;

CREATE TRIGGER financial_tb_snapshots_no_update
BEFORE UPDATE ON financial_trial_balance_snapshots
FOR EACH ROW EXECUTE FUNCTION prevent_financial_tb_snapshot_update();

CREATE TRIGGER financial_tb_snapshots_no_delete
BEFORE DELETE ON financial_trial_balance_snapshots
FOR EACH ROW EXECUTE FUNCTION prevent_financial_tb_snapshot_delete();

COMMIT;
