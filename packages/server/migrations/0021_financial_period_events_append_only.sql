-- packages/server/migrations/0021_financial_period_events_append_only.sql
-- FINANCIAL PERIOD EVENTS (APPEND-ONLY, IMMUTABLE)
-- Finance Core — Period governance event stream
--
-- Properties:
-- - Append-only: no UPDATE, no DELETE
-- - Actor-enforced (actor_id, actor_roles required)
-- - Deterministic checksum field (provided by application boundary)
-- - Supports period lifecycle: create/close/reopen + legal hold

BEGIN;

CREATE TABLE IF NOT EXISTS public.financial_period_events (
  event_id      uuid PRIMARY KEY,
  period_id     uuid NOT NULL,

  event_type    text NOT NULL,

  period_from   date,
  period_to     date,
  label         text,

  occurred_at   timestamptz NOT NULL,
  recorded_at   timestamptz NOT NULL DEFAULT now(),

  actor_id      text NOT NULL,
  actor_roles   text[] NOT NULL,
  reason        text NOT NULL,

  checksum      text NOT NULL,

  CONSTRAINT financial_period_events_event_type_nonempty CHECK (length(trim(event_type)) > 0),
  CONSTRAINT financial_period_events_actor_id_nonempty CHECK (length(trim(actor_id)) > 0),
  CONSTRAINT financial_period_events_reason_nonempty CHECK (length(trim(reason)) > 0),
  CONSTRAINT financial_period_events_checksum_nonempty CHECK (length(trim(checksum)) > 0),

  -- When creating a period, these must be present (enforced at application as well).
  CONSTRAINT financial_period_events_period_range_valid CHECK (
    (period_from IS NULL AND period_to IS NULL) OR
    (period_from IS NOT NULL AND period_to IS NOT NULL AND period_from <= period_to)
  )
);

-- ─────────────────────────────────────────────────────────────
-- Immutability triggers (NO UPDATE / NO DELETE)
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.prevent_financial_period_event_update()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'financial_period_events is append-only: UPDATE is forbidden';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.prevent_financial_period_event_delete()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'financial_period_events is append-only: DELETE is forbidden';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS financial_period_events_no_update ON public.financial_period_events;
CREATE TRIGGER financial_period_events_no_update
BEFORE UPDATE ON public.financial_period_events
FOR EACH ROW EXECUTE FUNCTION public.prevent_financial_period_event_update();

DROP TRIGGER IF EXISTS financial_period_events_no_delete ON public.financial_period_events;
CREATE TRIGGER financial_period_events_no_delete
BEFORE DELETE ON public.financial_period_events
FOR EACH ROW EXECUTE FUNCTION public.prevent_financial_period_event_delete();

-- ─────────────────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_fin_period_events_period
  ON public.financial_period_events(period_id);

CREATE INDEX IF NOT EXISTS idx_fin_period_events_type
  ON public.financial_period_events(event_type);

CREATE INDEX IF NOT EXISTS idx_fin_period_events_occurred_at
  ON public.financial_period_events(occurred_at);

CREATE INDEX IF NOT EXISTS idx_fin_period_events_range
  ON public.financial_period_events(period_from, period_to);

COMMIT;
