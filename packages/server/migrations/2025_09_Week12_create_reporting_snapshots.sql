-- Migration: Week 12 - Reporting Snapshots Persistence
-- Purpose  : Append-only, audit-safe storage for reporting snapshots
-- Notes    :
--   - NO UPDATE
--   - NO DELETE
--   - Financially auditable
--   - JSONB payload
--   - Version-aware
--   - Checksum enforced at write-time (application)

BEGIN;

CREATE TABLE reporting_snapshots (
    id UUID PRIMARY KEY,
    snapshot_type TEXT NOT NULL,
    snapshot_version INTEGER NOT NULL,

    period_start DATE NOT NULL,
    period_end DATE NOT NULL,

    payload JSONB NOT NULL,

    checksum TEXT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    superseded_by UUID NULL,

    CONSTRAINT reporting_snapshots_period_check
        CHECK (period_start <= period_end)
);

-- Prevent accidental updates
CREATE OR REPLACE FUNCTION forbid_update_reporting_snapshots()
RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'UPDATE is not allowed on reporting_snapshots (append-only table)';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_no_update_reporting_snapshots
BEFORE UPDATE ON reporting_snapshots
FOR EACH ROW
EXECUTE FUNCTION forbid_update_reporting_snapshots();

-- Prevent accidental deletes
CREATE OR REPLACE FUNCTION forbid_delete_reporting_snapshots()
RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'DELETE is not allowed on reporting_snapshots (append-only table)';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_no_delete_reporting_snapshots
BEFORE DELETE ON reporting_snapshots
FOR EACH ROW
EXECUTE FUNCTION forbid_delete_reporting_snapshots();

-- Indexes for query patterns
CREATE INDEX idx_reporting_snapshots_type_created
    ON reporting_snapshots (snapshot_type, created_at DESC);

CREATE INDEX idx_reporting_snapshots_created
    ON reporting_snapshots (created_at DESC);

COMMIT;
