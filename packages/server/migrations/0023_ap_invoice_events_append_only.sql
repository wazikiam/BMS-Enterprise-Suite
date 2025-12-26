-- packages/server/migrations/0023_ap_invoice_events_append_only.sql
-- AP INVOICE EVENTS (APPEND-ONLY EVENT STORE)
-- PHASE 6 — STEP 3
--
-- Guarantees:
-- - Append-only (NO UPDATE/DELETE)
-- - Idempotent writes via unique idempotency_key
-- - Deterministic querying via indexes
-- - Audit-safe payload storage

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- TABLE
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ap_invoice_events (
  event_id         uuid                     NOT NULL,
  invoice_id       uuid                     NOT NULL,
  event_type       text                     NOT NULL,

  actor_id         text                     NOT NULL,
  actor_roles      text[]                   NOT NULL,

  reason           text                     NOT NULL,
  idempotency_key  text                     NOT NULL,

  occurred_at      timestamp with time zone NOT NULL,

  payload_json     jsonb                    NOT NULL,

  CONSTRAINT pk_ap_invoice_events PRIMARY KEY (event_id),

  CONSTRAINT chk_ap_invoice_event_type_nonempty
    CHECK (length(trim(event_type)) > 0),

  CONSTRAINT chk_ap_invoice_actor_id_nonempty
    CHECK (length(trim(actor_id)) > 0),

  CONSTRAINT chk_ap_invoice_reason_nonempty
    CHECK (length(trim(reason)) > 0),

  CONSTRAINT chk_ap_invoice_idempotency_key_nonempty
    CHECK (length(trim(idempotency_key)) > 0)
);

-- Idempotency (exactly-once at command boundary)
CREATE UNIQUE INDEX IF NOT EXISTS ux_ap_invoice_events_idempotency_key
  ON public.ap_invoice_events (idempotency_key);

-- Deterministic stream access
CREATE INDEX IF NOT EXISTS idx_ap_invoice_events_invoice_id
  ON public.ap_invoice_events (invoice_id);

CREATE INDEX IF NOT EXISTS idx_ap_invoice_events_occurred_at
  ON public.ap_invoice_events (occurred_at);

CREATE INDEX IF NOT EXISTS idx_ap_invoice_events_invoice_id_occurred_at
  ON public.ap_invoice_events (invoice_id, occurred_at);

-- Optional payload search acceleration (kept minimal)
-- CREATE INDEX IF NOT EXISTS idx_ap_invoice_events_payload_gin
--   ON public.ap_invoice_events USING gin (payload_json);

-- ─────────────────────────────────────────────────────────────
-- APPEND-ONLY ENFORCEMENT
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_block_update_delete_ap_invoice_events()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'ap_invoice_events is append-only (UPDATE/DELETE forbidden)';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ap_invoice_events_block_update ON public.ap_invoice_events;
CREATE TRIGGER ap_invoice_events_block_update
BEFORE UPDATE ON public.ap_invoice_events
FOR EACH ROW
EXECUTE FUNCTION public.trg_block_update_delete_ap_invoice_events();

DROP TRIGGER IF EXISTS ap_invoice_events_block_delete ON public.ap_invoice_events;
CREATE TRIGGER ap_invoice_events_block_delete
BEFORE DELETE ON public.ap_invoice_events
FOR EACH ROW
EXECUTE FUNCTION public.trg_block_update_delete_ap_invoice_events();

COMMIT;
