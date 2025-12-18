-- 0018_hr_hardening_indexes.sql
-- BMS Enterprise Suite — HR Phase 1 (Step 1.6)
--
-- Purpose:
-- - Enforce critical invariants (employeeCode uniqueness)
-- - Add missing high-value indexes for HR read paths
-- - Respect existing schema and previously-created indexes
-- - Zero behavior change (hardening only)
--
-- Tables:
--   public.hr_employees
--   public.hr_employee_events
--
-- This migration is SAFE and IDEMPOTENT.

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1) Employees — invariants & lookup performance
-- ─────────────────────────────────────────────────────────────

-- Enforce unique employee_code (identity invariant)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'uq_hr_employees_employee_code'
  ) THEN
    ALTER TABLE public.hr_employees
      ADD CONSTRAINT uq_hr_employees_employee_code UNIQUE (employee_code);
  END IF;
END $$;

-- Fast lookup by employee_code
CREATE INDEX IF NOT EXISTS idx_hr_employees_employee_code
  ON public.hr_employees (employee_code);

-- Common HR filters (hire date)
CREATE INDEX IF NOT EXISTS idx_hr_employees_hire_date
  ON public.hr_employees (hire_date);

-- Name-based lookup / sorting
CREATE INDEX IF NOT EXISTS idx_hr_employees_name
  ON public.hr_employees (last_name, first_name);

-- ─────────────────────────────────────────────────────────────
-- 2) Events — audit & investigation performance
-- ─────────────────────────────────────────────────────────────

-- Composite index for event stream reads (per employee, ordered by time)
CREATE INDEX IF NOT EXISTS idx_hr_employee_events_employee_time
  ON public.hr_employee_events (employee_id, event_time);

-- Filter by event type per employee (investigations / audits)
CREATE INDEX IF NOT EXISTS idx_hr_employee_events_employee_type
  ON public.hr_employee_events (employee_id, event_type);

COMMIT;
