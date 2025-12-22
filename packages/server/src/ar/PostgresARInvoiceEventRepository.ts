// packages/server/src/ar/PostgresARInvoiceEventRepository.ts
// Postgres event repository for AR invoices (append-only)
//
// Contract:
// - DB uses snake_case columns
// - App uses camelCase records
// - This repo is the ONLY DB boundary for AR invoice events

import { Pool } from 'pg';

export type ARInvoiceEventRecord = {
  eventId: string;
  invoiceId: string;
  eventType: string;
  payload: any;
  eventTime: Date;
};

export class PostgresARInvoiceEventRepository {
  constructor(private readonly pool: Pool) {}

  async append(params: {
    eventId: string;
    invoiceId: string;
    eventType: string;
    payload: any;
  }): Promise<void> {
    const sql = `
      INSERT INTO ar_invoice_events (
        event_id,
        invoice_id,
        event_type,
        actor_id,
        actor_roles,
        reason,
        event_time,
        payload
      ) VALUES (
        $1, $2, $3,
        $4, $5,
        $6,
        now(),
        $7::jsonb
      )
    `;

    // Governance-safe defaults for DEV/READ flows:
    // Command-side can remain business-intent-only.
    const actorId = 'system';
    const actorRoles = ['SYSTEM'];
    const reason = 'system';

    await this.pool.query(sql, [
      params.eventId,
      params.invoiceId,
      params.eventType,
      actorId,
      actorRoles,
      reason,
      JSON.stringify(params.payload ?? {}),
    ]);
  }

  async listByInvoice(invoiceId: string): Promise<ARInvoiceEventRecord[]> {
    const sql = `
      SELECT
        event_id,
        invoice_id,
        event_type,
        event_time,
        payload
      FROM ar_invoice_events
      WHERE invoice_id = $1
      ORDER BY event_time ASC
    `;

    const { rows } = await this.pool.query(sql, [invoiceId]);

    return rows.map((r) => ({
      eventId: r.event_id,
      invoiceId: r.invoice_id,
      eventType: r.event_type,
      eventTime: new Date(r.event_time),
      payload: r.payload ?? {},
    }));
  }

  async listAllEvents(): Promise<ARInvoiceEventRecord[]> {
    const sql = `
      SELECT
        event_id,
        invoice_id,
        event_type,
        event_time,
        payload
      FROM ar_invoice_events
      ORDER BY invoice_id ASC, event_time ASC
    `;

    const { rows } = await this.pool.query(sql);

    return rows.map((r) => ({
      eventId: r.event_id,
      invoiceId: r.invoice_id,
      eventType: r.event_type,
      eventTime: new Date(r.event_time),
      payload: r.payload ?? {},
    }));
  }
}
