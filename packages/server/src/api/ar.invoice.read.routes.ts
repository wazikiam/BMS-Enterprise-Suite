// packages/server/src/api/ar.invoice.read.routes.ts
// ACCOUNTS RECEIVABLE — INVOICE READ PROJECTION
//
// - Read-only
// - Event-sourced
// - Deterministic
// - Core-boundary safe

import { Router, Request, Response } from 'express';
import { getPostgresPool } from '../db/PostgresClient';
import { PostgresARInvoiceEventRepository } from '../ar/PostgresARInvoiceEventRepository';
import { applyARInvoiceEvent } from '@bms/core/src/ar/AccountsReceivable';

const router = Router();

/**
 * DB → Domain Event (structural, runtime-safe)
 */
function mapToDomainEvent(row: any): any {
  const payload = row.payload ?? {};

  if (row.event_type === 'AR_INVOICE_CREATED') {
    return {
      type: 'AR_INVOICE_CREATED',
      invoiceId: row.invoice_id,
      customerId: payload.customerId,
      currency: payload.currency,
      occurredAt: row.event_time,
    };
  }

  if (row.event_type === 'AR_INVOICE_ISSUED') {
    return {
      type: 'AR_INVOICE_ISSUED',
      invoiceId: row.invoice_id,
      totalAmount: payload.totalAmount,
      issuedAt: new Date(payload.issuedAt),
      dueDate: payload.dueDate ? new Date(payload.dueDate) : undefined,
      occurredAt: row.event_time,
    };
  }

  throw new Error(`Unsupported AR event type: ${row.event_type}`);
}

/**
 * GET /api/ar/invoices/:invoiceId
 */
router.get('/invoices/:invoiceId', async (req: Request, res: Response) => {
  try {
    const { invoiceId } = req.params;

    const pool = getPostgresPool();
    const repo = new PostgresARInvoiceEventRepository(pool);

    const records = await repo.listByInvoice(invoiceId);

    if (records.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const events = records.map(mapToDomainEvent);

    // ✅ CRITICAL FIX:
    // Explicit accumulator typing prevents TS overload confusion
    let state: any = undefined;
    for (const event of events) {
      state = applyARInvoiceEvent(state, event);
    }

    res.json({ invoice: state });
  } catch (err: any) {
    res.status(503).json({
      error: 'AR invoice read unavailable',
      reason: err?.message ?? 'infrastructure error',
    });
  }
});

export default router;
