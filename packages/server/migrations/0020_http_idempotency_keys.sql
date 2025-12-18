-- 0020_http_idempotency_keys.sql
-- HTTP Idempotency Store (Append-Only, Audit-Safe)

BEGIN;

CREATE TABLE IF NOT EXISTS public.http_idempotency_keys (
  key TEXT PRIMARY KEY,

  request_hash TEXT NOT NULL,

  response_body JSONB NOT NULL,
  status_code INTEGER NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Prevent mutation: append-only guarantee

CREATE OR REPLACE FUNCTION prevent_http_idempotency_update()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'http_idempotency_keys is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION prevent_http_idempotency_delete()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'http_idempotency_keys is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS http_idempotency_no_update
  ON public.http_idempotency_keys;

CREATE TRIGGER http_idempotency_no_update
BEFORE UPDATE ON public.http_idempotency_keys
FOR EACH ROW EXECUTE FUNCTION prevent_http_idempotency_update();

DROP TRIGGER IF EXISTS http_idempotency_no_delete
  ON public.http_idempotency_keys;

CREATE TRIGGER http_idempotency_no_delete
BEFORE DELETE ON public.http_idempotency_keys
FOR EACH ROW EXECUTE FUNCTION prevent_http_idempotency_delete();

COMMIT;
