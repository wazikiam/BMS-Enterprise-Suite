// packages/server/src/ap/PostgresAPInvoiceEventRepository.ts
// Postgres event repository for AP invoices (append-only)
//
// Contract:
// - DB uses snake_case columns
// - App uses camelCase records
// - This repo is the ONLY DB boundary for ap_invoice_events
// - Append-only is enforced by DB triggers (no UPDATE/DELETE); repo must never attempt them

import { Pool } from 'pg';

export type APInvoiceEventType =
  | 'AP_INVOICE_ISSUED'
  | 'AP_INVOICE_UPDATED_METADATA'
  | 'AP_INVOICE_VOIDED';

export type APInvoiceEventRecord = {
  eventId: string;
  invoiceId: string;
  eventType: APInvoiceEventType;

  actorId: string;
  actorRoles: readonly string[];

  reason: string;
  idempotencyKey: string;

  occurredAt: string; // ISO-8601 UTC string

  payloadJson: unknown; // full event envelope (jsonb)
};

type DbRow = {
  event_id: string;
  invoice_id: string;
  event_type: string;

  actor_id: string;
  actor_roles: string[];

  reason: string;
  idempotency_key: string;

  occurred_at: Date;

  payload_json: unknown;
};

export class PostgresAPInvoiceEventRepository {
  constructor(private readonly pool: Pool) {
    if (!pool) throw new Error('PostgresAPInvoiceEventRepository requires a database pool');
  }

  /**
   * Append a single AP invoice event (authoritative write).
   *
   * Idempotency:
   * - DB enforces unique(idempotency_key).
   * - Caller should pre-check via findByIdempotencyKey when needed.
   */
  async append(event: APInvoiceEventRecord): Promise<void> {
    const sql = `
      INSERT INTO public.ap_invoice_events (
        event_id,
        invoice_id,
        event_type,
        actor_id,
        actor_roles,
        reason,
        idempotency_key,
        occurred_at,
        payload_json
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9
      )
    `;

    const values = [
      event.eventId,
      event.invoiceId,
      event.eventType,
      event.actorId,
      [...event.actorRoles],
      event.reason,
      event.idempotencyKey,
      new Date(event.occurredAt),
      event.payloadJson,
    ];

    await this.pool.query(sql, values);
  }

  /**
   * Deterministic event stream by invoiceId.
   */
  async listByInvoiceId(invoiceId: string): Promise<APInvoiceEventRecord[]> {
    const sql = `
      SELECT
        event_id,
        invoice_id,
        event_type,
        actor_id,
        actor_roles,
        reason,
        idempotency_key,
        occurred_at,
        payload_json
      FROM public.ap_invoice_events
      WHERE invoice_id = $1
      ORDER BY occurred_at ASC, event_id ASC
    `;

    const res = await this.pool.query<DbRow>(sql, [invoiceId]);
    return res.rows.map(mapRowToRecord);
  }

  /**
   * Find by idempotency key. Returns null if not found.
   * Used to enforce command idempotency at the write boundary.
   */
  async findByIdempotencyKey(idempotencyKey: string): Promise<APInvoiceEventRecord | null> {
    const sql = `
      SELECT
        event_id,
        invoice_id,
        event_type,
        actor_id,
        actor_roles,
        reason,
        idempotency_key,
        occurred_at,
        payload_json
      FROM public.ap_invoice_events
      WHERE idempotency_key = $1
      LIMIT 1
    `;

    const res = await this.pool.query<DbRow>(sql, [idempotencyKey]);
    if (res.rows.length === 0) return null;
    return mapRowToRecord(res.rows[0]);
  }
}

function mapRowToRecord(r: DbRow): APInvoiceEventRecord {
  return {
    eventId: r.event_id,
    invoiceId: r.invoice_id,
    eventType: r.event_type as APInvoiceEventType,

    actorId: r.actor_id,
    actorRoles: r.actor_roles,

    reason: r.reason,
    idempotencyKey: r.idempotency_key,

    occurredAt: r.occurred_at.toISOString(),

    payloadJson: r.payload_json,
  };
}
