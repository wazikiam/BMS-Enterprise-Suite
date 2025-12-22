// packages/server/src/api/ar.read.routes.ts
// ACCOUNTS RECEIVABLE — READ API (Invoice list)
// Deterministic projection derived strictly from ar_invoice_events
//
// GET /api/ar/invoices
// - lists invoices with basic projected fields
// - does NOT couple to ledger
// - does NOT mutate

import { Router, Request, Response } from 'express';
import { getPostgresPool } from '../db/PostgresClient';
import { PostgresARInvoiceEventRepository } from '../ar/PostgresARInvoiceEventRepository';

const router = Router();

/**
 * GET /api/ar/invoices
 *
 * Returns a deterministic list of invoices derived from events.
 * Projection rules:
 * - customerId comes from AR_INVOICE_CREATED payload.customerId
 * - dueDate comes from AR_INVOICE_ISSUED payload.dueDate (if present)
 * - invoices are sorted by invoiceId ASC
 */
router.get('/invoices', async (_req: Request, res: Response) => {
  try {
    const pool = getPostgresPool();
    const repo = new PostgresARInvoiceEventRepository(pool);

    const events = await repo.listAllEvents();

    const byInvoice = new Map<string, Array<{ eventType: string; payload: any }>>();

    for (const e of events) {
      if (!byInvoice.has(e.invoiceId)) byInvoice.set(e.invoiceId, []);
      byInvoice.get(e.invoiceId)!.push({ eventType: e.eventType, payload: e.payload ?? {} });
    }

    const invoiceIds = Array.from(byInvoice.keys()).sort((a, b) => a.localeCompare(b));

    const invoices = invoiceIds.map((invoiceId) => {
      const stream = byInvoice.get(invoiceId) ?? [];

      const created = stream.find((x) => x.eventType === 'AR_INVOICE_CREATED');
      const issued = stream.find((x) => x.eventType === 'AR_INVOICE_ISSUED');

      const customerId =
        created?.payload?.customerId ?? null;

      const dueDate =
        issued?.payload?.dueDate ?? null;

      return {
        invoiceId,
        customerId,
        dueDate,
      };
    });

    return res.status(200).json({ invoices });
  } catch (err: any) {
    return res.status(503).json({
      error: 'Failed to read AR invoices',
      reason: err?.message ?? 'infrastructure error',
    });
  }
});

export default router;
