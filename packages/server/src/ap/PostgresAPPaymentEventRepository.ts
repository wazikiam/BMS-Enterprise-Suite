// packages/server/src/ap/PostgresAPPaymentEventRepository.ts
// Postgres event repository for AP payments (append-only)
//
// Contract:
// - DB uses snake_case columns
// - App uses camelCase records
// - This repo is the ONLY DB boundary for ap_payment_events
// - Append-only is enforced by DB triggers (no UPDATE/DELETE); repo must never attempt them

import { Pool } from 'pg';

export type APPaymentEventType =
  | 'AP_PAYMENT_RECORDED'
  | 'AP_PAYMENT_ALLOCATED_TO_INVOICE'
  | 'AP_PAYMENT_UNALLOCATED_FROM_INVOICE'
  | 'AP_PAYMENT_REVERSED';

export type APPaymentEventRecord = {
  eventId: string;
  paymentId: string;
  eventType: APPaymentEventType;

  actorId: string;
  actorRoles: readonly string[];

  reason: string;
  idempotencyKey: string;

  occurredAt: string; // ISO-8601 UTC string

  payloadJson: unknown; // full event envelope (jsonb)
};

type DbRow = {
  event_id: string;
  payment_id: string;
  event_type: string;

  actor_id: string;
  actor_roles: string[];

  reason: string;
  idempotency_key: string;

  occurred_at: Date;

  payload_json: unknown;
};

export class PostgresAPPaymentEventRepository {
  constructor(private readonly pool: Pool) {
    if (!pool) throw new Error('PostgresAPPaymentEventRepository requires a database pool');
  }

  /**
   * Append a single AP payment event (authoritative write).
   *
   * Idempotency:
   * - DB enforces unique(idempotency_key).
   * - Caller should pre-check via findByIdempotencyKey when needed.
   */
  async append(event: APPaymentEventRecord): Promise<void> {
    const sql = `
      INSERT INTO public.ap_payment_events (
        event_id,
        payment_id,
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
      event.paymentId,
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
   * Deterministic event stream by paymentId.
   */
  async listByPaymentId(paymentId: string): Promise<APPaymentEventRecord[]> {
    const sql = `
      SELECT
        event_id,
        payment_id,
        event_type,
        actor_id,
        actor_roles,
        reason,
        idempotency_key,
        occurred_at,
        payload_json
      FROM public.ap_payment_events
      WHERE payment_id = $1
      ORDER BY occurred_at ASC, event_id ASC
    `;

    const res = await this.pool.query<DbRow>(sql, [paymentId]);
    return res.rows.map(mapRowToRecord);
  }

  /**
   * Find by idempotency key. Returns null if not found.
   * Used to enforce command idempotency at the write boundary.
   */
  async findByIdempotencyKey(idempotencyKey: string): Promise<APPaymentEventRecord | null> {
    const sql = `
      SELECT
        event_id,
        payment_id,
        event_type,
        actor_id,
        actor_roles,
        reason,
        idempotency_key,
        occurred_at,
        payload_json
      FROM public.ap_payment_events
      WHERE idempotency_key = $1
      LIMIT 1
    `;

    const res = await this.pool.query<DbRow>(sql, [idempotencyKey]);
    if (res.rows.length === 0) return null;
    return mapRowToRecord(res.rows[0]);
  }
}

function mapRowToRecord(r: DbRow): APPaymentEventRecord {
  return {
    eventId: r.event_id,
    paymentId: r.payment_id,
    eventType: r.event_type as APPaymentEventType,

    actorId: r.actor_id,
    actorRoles: r.actor_roles,

    reason: r.reason,
    idempotencyKey: r.idempotency_key,

    occurredAt: r.occurred_at.toISOString(),

    payloadJson: r.payload_json,
  };
}
