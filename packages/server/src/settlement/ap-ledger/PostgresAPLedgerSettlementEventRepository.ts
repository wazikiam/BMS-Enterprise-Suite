// packages/server/src/settlement/ap-ledger/PostgresAPLedgerSettlementEventRepository.ts
// Postgres event repository for AP → Ledger settlement events (append-only)
//
// Contract:
// - DB uses snake_case columns
// - App uses camelCase records
// - This repo is the ONLY DB boundary for ap_ledger_settlement_events
// - Append-only enforced by DB triggers (no UPDATE/DELETE); repo must never attempt them

import { Pool } from 'pg';

export type APLedgerSettlementEventType =
  | 'AP_INVOICE_POSTED_TO_LEDGER'
  | 'AP_PAYMENT_POSTED_TO_LEDGER'
  | 'AP_LEDGER_POSTING_REVERSED';

export type APLedgerSettlementEventRecord = {
  eventId: string;
  settlementId: string;

  eventType: APLedgerSettlementEventType;

  actorId: string;
  actorRoles: readonly string[];

  reason: string;
  idempotencyKey: string;

  occurredAt: string; // ISO-8601 UTC string

  invoiceId?: string | null;
  paymentId?: string | null;
  supplierId?: string | null;

  ledgerBatchId?: string | null;
  originalSettlementEventId?: string | null;

  journalJson: unknown; // deterministic journal payload (jsonb)
  reversalJournalJson?: unknown | null;

  payloadJson: unknown; // full event envelope (jsonb)
};

type DbRow = {
  event_id: string;
  settlement_id: string;

  event_type: string;

  actor_id: string;
  actor_roles: string[];

  reason: string;
  idempotency_key: string;

  occurred_at: Date;

  invoice_id: string | null;
  payment_id: string | null;
  supplier_id: string | null;

  ledger_batch_id: string | null;
  original_settlement_event_id: string | null;

  journal_json: unknown;
  reversal_journal_json: unknown | null;

  payload_json: unknown;
};

export class PostgresAPLedgerSettlementEventRepository {
  constructor(private readonly pool: Pool) {
    if (!pool) throw new Error('PostgresAPLedgerSettlementEventRepository requires a database pool');
  }

  /**
   * Append a single settlement event (authoritative write).
   * Determinism:
   * - Ordering by occurred_at is allowed, but event_id is the primary identity.
   * - Idempotency is enforced by unique index on idempotency_key.
   */
  async append(event: APLedgerSettlementEventRecord): Promise<void> {
    const sql = `
      INSERT INTO public.ap_ledger_settlement_events (
        event_id,
        settlement_id,
        event_type,
        actor_id,
        actor_roles,
        reason,
        idempotency_key,
        occurred_at,
        invoice_id,
        payment_id,
        supplier_id,
        ledger_batch_id,
        original_settlement_event_id,
        journal_json,
        reversal_journal_json,
        payload_json
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,
        $9,$10,$11,$12,$13,$14,$15,$16
      )
    `;

    const values = [
      event.eventId,
      event.settlementId,
      event.eventType,
      event.actorId,
      [...event.actorRoles],
      event.reason,
      event.idempotencyKey,
      new Date(event.occurredAt),

      event.invoiceId ?? null,
      event.paymentId ?? null,
      event.supplierId ?? null,

      event.ledgerBatchId ?? null,
      event.originalSettlementEventId ?? null,

      event.journalJson,
      event.reversalJournalJson ?? null,
      event.payloadJson,
    ];

    await this.pool.query(sql, values);
  }

  /**
   * Load events by settlementId (deterministic stream).
   */
  async listBySettlementId(settlementId: string): Promise<APLedgerSettlementEventRecord[]> {
    const sql = `
      SELECT
        event_id,
        settlement_id,
        event_type,
        actor_id,
        actor_roles,
        reason,
        idempotency_key,
        occurred_at,
        invoice_id,
        payment_id,
        supplier_id,
        ledger_batch_id,
        original_settlement_event_id,
        journal_json,
        reversal_journal_json,
        payload_json
      FROM public.ap_ledger_settlement_events
      WHERE settlement_id = $1
      ORDER BY occurred_at ASC, event_id ASC
    `;
    const res = await this.pool.query<DbRow>(sql, [settlementId]);
    return res.rows.map(mapRowToRecord);
  }

  /**
   * Load events for a given invoiceId (supports audit traceability).
   */
  async listByInvoiceId(invoiceId: string): Promise<APLedgerSettlementEventRecord[]> {
    const sql = `
      SELECT
        event_id,
        settlement_id,
        event_type,
        actor_id,
        actor_roles,
        reason,
        idempotency_key,
        occurred_at,
        invoice_id,
        payment_id,
        supplier_id,
        ledger_batch_id,
        original_settlement_event_id,
        journal_json,
        reversal_journal_json,
        payload_json
      FROM public.ap_ledger_settlement_events
      WHERE invoice_id = $1
      ORDER BY occurred_at ASC, event_id ASC
    `;
    const res = await this.pool.query<DbRow>(sql, [invoiceId]);
    return res.rows.map(mapRowToRecord);
  }

  /**
   * Load events for a given paymentId (supports audit traceability).
   */
  async listByPaymentId(paymentId: string): Promise<APLedgerSettlementEventRecord[]> {
    const sql = `
      SELECT
        event_id,
        settlement_id,
        event_type,
        actor_id,
        actor_roles,
        reason,
        idempotency_key,
        occurred_at,
        invoice_id,
        payment_id,
        supplier_id,
        ledger_batch_id,
        original_settlement_event_id,
        journal_json,
        reversal_journal_json,
        payload_json
      FROM public.ap_ledger_settlement_events
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
  async findByIdempotencyKey(idempotencyKey: string): Promise<APLedgerSettlementEventRecord | null> {
    const sql = `
      SELECT
        event_id,
        settlement_id,
        event_type,
        actor_id,
        actor_roles,
        reason,
        idempotency_key,
        occurred_at,
        invoice_id,
        payment_id,
        supplier_id,
        ledger_batch_id,
        original_settlement_event_id,
        journal_json,
        reversal_journal_json,
        payload_json
      FROM public.ap_ledger_settlement_events
      WHERE idempotency_key = $1
      LIMIT 1
    `;
    const res = await this.pool.query<DbRow>(sql, [idempotencyKey]);
    if (res.rows.length === 0) return null;
    return mapRowToRecord(res.rows[0]);
  }
}

function mapRowToRecord(r: DbRow): APLedgerSettlementEventRecord {
  return {
    eventId: r.event_id,
    settlementId: r.settlement_id,

    eventType: r.event_type as APLedgerSettlementEventType,

    actorId: r.actor_id,
    actorRoles: r.actor_roles,

    reason: r.reason,
    idempotencyKey: r.idempotency_key,

    occurredAt: r.occurred_at.toISOString(),

    invoiceId: r.invoice_id,
    paymentId: r.payment_id,
    supplierId: r.supplier_id,

    ledgerBatchId: r.ledger_batch_id,
    originalSettlementEventId: r.original_settlement_event_id,

    journalJson: r.journal_json,
    reversalJournalJson: r.reversal_journal_json,

    payloadJson: r.payload_json,
  };
}
