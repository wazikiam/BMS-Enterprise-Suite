// packages/server/src/ar/PostgresARInvoiceEventRepository.ts
// ACCOUNTS RECEIVABLE — INVOICE EVENT REPOSITORY (APPEND-ONLY)
//
// - Writes immutable AR invoice events
// - Reads full event streams by invoice
// - NO updates
// - NO deletes
// - Infrastructure-only (no business logic)

import { ARInvoiceEvent } from '@bms/core/src/ar/AccountsReceivable';

export interface SqlClient {
  query<T = any>(
    text: string,
    params?: any[]
  ): Promise<{ rows: T[] }>;
}

type ARInvoiceEventRow = {
  event_id: string;
  invoice_id: string;
  event_type: string;
  actor_id: string;
  actor_roles: string[];
  reason: string;
  event_time: string;
  payload: any;
};

export class PostgresARInvoiceEventRepository {
  constructor(private readonly db: SqlClient) {}

  /**
   * Append a single AR invoice event.
   *
   * NOTE:
   * - Caller is responsible for validation
   * - This method enforces append-only semantics
   */
  async append(
    eventId: string,
    invoiceId: string,
    event: ARInvoiceEvent,
    actor: {
      actorId: string;
      actorRoles: readonly string[];
    },
    reason: string
  ): Promise<void> {
    const sql = `
      INSERT INTO public.ar_invoice_events (
        event_id,
        invoice_id,
        event_type,
        actor_id,
        actor_roles,
        reason,
        event_time,
        payload
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8
      );
    `;

    const params = [
      eventId,
      invoiceId,
      event.type,
      actor.actorId,
      actor.actorRoles,
      reason,
      event.occurredAt.toISOString(),
      event,
    ];

    await this.db.query(sql, params);
  }

  /**
   * List all AR invoice events for a given invoice.
   *
   * Ordered deterministically by event_time ASC.
   */
  async listByInvoice(
    invoiceId: string
  ): Promise<ARInvoiceEvent[]> {
    const sql = `
      SELECT *
      FROM public.ar_invoice_events
      WHERE invoice_id = $1
      ORDER BY event_time ASC;
    `;

    const result = await this.db.query<ARInvoiceEventRow>(
      sql,
      [invoiceId]
    );

    return result.rows.map(this.mapRow);
  }

  private mapRow(row: ARInvoiceEventRow): ARInvoiceEvent {
    return {
      ...row.payload,
      occurredAt: new Date(row.event_time),
    } as ARInvoiceEvent;
  }
}
