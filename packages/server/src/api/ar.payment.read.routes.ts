// packages/server/src/api/ar.payment.read.routes.ts
// ACCOUNTS RECEIVABLE — PAYMENT READ PROJECTION
//
// - Read-only
// - Event-sourced
// - Deterministic
// - Audit-safe
// - Mirrors AR Invoice READ pattern

import { Router, Request, Response } from 'express';
import { getPostgresPool } from '../db/PostgresClient';

const router = Router();

/**
 * DB → Domain Event (structural, runtime-safe)
 */
function mapToDomainEvent(row: any): any {
  switch (row.event_type) {
    case 'AR_PAYMENT_CREATED':
      return {
        type: 'AR_PAYMENT_CREATED',
        paymentId: row.payment_id,
        occurredAt: row.occurred_at,
        reason: row.reason,
      };

    case 'AR_PAYMENT_RECORDED':
      return {
        type: 'AR_PAYMENT_RECORDED',
        paymentId: row.payment_id,
        invoiceId: row.invoice_id,
        amountMinor: row.amount_minor,
        currency: row.currency,
        occurredAt: row.occurred_at,
        reason: row.reason,
      };

    case 'AR_PAYMENT_VOIDED':
      return {
        type: 'AR_PAYMENT_VOIDED',
        paymentId: row.payment_id,
        occurredAt: row.occurred_at,
        reason: row.reason,
      };

    default:
      throw new Error(`Unsupported AR payment event type: ${row.event_type}`);
  }
}

/**
 * GET /api/ar/payments/:paymentId
 */
router.get('/payments/:paymentId', async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.params;

    const pool = getPostgresPool();

    const { rows } = await pool.query(
      `
      SELECT
        event_id,
        payment_id,
        invoice_id,
        event_type,
        amount_minor,
        currency,
        occurred_at,
        reason
      FROM public.ar_payment_events
      WHERE payment_id = $1
      ORDER BY occurred_at ASC
      `,
      [paymentId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    const events = rows.map(mapToDomainEvent);

    res.json({
      paymentId,
      events,
    });
  } catch (err: any) {
    res.status(503).json({
      error: 'AR payment read unavailable',
      reason: err?.message ?? 'infrastructure error',
    });
  }
});

export default router;
