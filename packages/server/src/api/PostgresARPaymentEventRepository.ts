// packages/server/src/api/PostgresARPaymentEventRepository.ts
// POSTGRES AR PAYMENT EVENT REPOSITORY (APPEND-ONLY)
// - No reads
// - No updates
// - No deletes
// - Actor-enforced
// - Deterministic checksum via core gateway

import {
  ARPaymentEventRecord,
} from '@bms/core/src/ar/payments/ARPaymentWriteGateway';

export interface SqlClient {
  query<T = any>(text: string, params?: any[]): Promise<{ rows: T[] }>;
}

function assertUuid(id: string, field: string): void {
  const re =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!re.test(id)) throw new Error(`Invalid UUID for ${field}: ${id}`);
}

export class PostgresARPaymentEventRepository {
  constructor(private readonly db: SqlClient) {}

  /**
   * Append a single AR payment event.
   * This is the ONLY sanctioned write entry into public.ar_payment_events.
   */
  async append(event: ARPaymentEventRecord): Promise<ARPaymentEventRecord> {
    // Boundary validation
    assertUuid(event.eventId, 'eventId');
    assertUuid(event.paymentId, 'paymentId');

    if ('invoiceId' in event && event.invoiceId) {
      assertUuid(event.invoiceId, 'invoiceId');
    }

    const sql = `
      INSERT INTO public.ar_payment_events (
        event_id,
        payment_id,
        event_type,
        occurred_at,
        recorded_at,
        amount_minor,
        currency,
        invoice_id,
        actor_id,
        actor_roles,
        reason,
        checksum
      )
      VALUES (
        $1,  $2,  $3,  $4,  $5,
        $6,  $7,  $8,  $9,  $10,
        $11, $12
      );
    `;

    const params = [
      event.eventId,
      event.paymentId,
      event.eventType,
      new Date(event.eventTime).toISOString(), // canonical time from core
      event.recordedAt.toISOString(),
      'amountMinor' in event ? event.amountMinor ?? null : null,
      'currency' in event ? event.currency ?? null : null,
      'invoiceId' in event ? event.invoiceId ?? null : null,
      event.actorId,
      Array.from(event.actorRoles),
      event.reason,
      event.checksum,
    ];

    await this.db.query(sql, params);

    return event;
  }
}
