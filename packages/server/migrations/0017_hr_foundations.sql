-- packages/server/migrations/0017_hr_foundations.sql
-- HR Foundations (Phase 1)
-- Bank-grade: append-only events + current projection

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1) Current projection table
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hr_employees (
  employee_id           UUID PRIMARY KEY,
  employee_code         TEXT UNIQUE NOT NULL,

  first_name            TEXT NOT NULL,
  last_name             TEXT NOT NULL,

  status                TEXT NOT NULL CHECK (status IN ('ACTIVE','SUSPENDED','TERMINATED')),
  hire_date             DATE NOT NULL,
  termination_date      DATE NULL,

  contract_type         TEXT NOT NULL CHECK (contract_type IN ('PERMANENT','FIXED','CONSULTANT')),
  department_id         UUID NULL,
  manager_employee_id   UUID NULL,

  -- Contact (HIGH sensitivity; stored but access-restricted)
  work_email            TEXT NULL,
  work_phone            TEXT NULL,
  address_line          TEXT NULL,

  -- Legal (RESTRICTED; stored but access-restricted)
  national_id           TEXT NULL,
  tax_identifier        TEXT NULL,
  social_security_number TEXT NULL,

  -- Business roles (non-system)
  business_roles        TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_employees_status ON hr_employees(status);
CREATE INDEX IF NOT EXISTS idx_hr_employees_department ON hr_employees(department_id);

-- ─────────────────────────────────────────────────────────────
-- 2) Append-only event log
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hr_employee_events (
  event_id              UUID PRIMARY KEY,
  employee_id           UUID NOT NULL REFERENCES hr_employees(employee_id),

  event_type            TEXT NOT NULL CHECK (event_type IN (
    'EMPLOYEE_CREATED',
    'EMPLOYEE_UPDATED',
    'EMPLOYEE_STATUS_CHANGED',
    'EMPLOYEE_TERMINATED',
    'EMPLOYEE_MASKED'
  )),

  actor_id              TEXT NOT NULL,
  actor_roles           TEXT[] NOT NULL,

  reason                TEXT NOT NULL,
  event_time            TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Store changes in a generic JSON structure for audit
  -- Must NOT include secrets; only HR domain fields
  payload               JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hr_employee_events_employee ON hr_employee_events(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_employee_events_time ON hr_employee_events(event_time);

-- ─────────────────────────────────────────────────────────────
-- 3) Immutability enforcement for event log
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION hr_employee_events_immutable()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'hr_employee_events is append-only and immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_hr_employee_events_no_update ON hr_employee_events;
CREATE TRIGGER trg_hr_employee_events_no_update
BEFORE UPDATE ON hr_employee_events
FOR EACH ROW EXECUTE FUNCTION hr_employee_events_immutable();

DROP TRIGGER IF EXISTS trg_hr_employee_events_no_delete ON hr_employee_events;
CREATE TRIGGER trg_hr_employee_events_no_delete
BEFORE DELETE ON hr_employee_events
FOR EACH ROW EXECUTE FUNCTION hr_employee_events_immutable();

-- ─────────────────────────────────────────────────────────────
-- 4) updated_at maintenance
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_hr_employees_updated_at ON hr_employees;
CREATE TRIGGER trg_hr_employees_updated_at
BEFORE UPDATE ON hr_employees
FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

COMMIT;
