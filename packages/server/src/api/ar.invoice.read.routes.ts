// packages/server/src/api/ar.invoice.read.routes.ts
// ACCOUNTS RECEIVABLE — INVOICE READ API (PHASE 4.2)
//
// - Read-only
// - Deterministic
// - Event-sourced
// - UI-safe projection
// - No ledger coupling
// - Governance-safe

import { Router, Request, Response } from 'express';
import { getPostgresPool } from '../db/PostgresClient';
import { PostgresARInvoiceEventRepository } from '../ar/PostgresARInvoiceEventRepository';
import { applyARInvoiceEvent } from '@bms/core/src/ar/AccountsReceivable';

const router = Router();

/**
 * Internal read projection
 * Stable, UI-safe shape
 */
function projectInvoice(invoiceId: string, state: any) {
  return {
    invoiceId,
    customerId: state.customerId ?? null,
    status: state.status,
    currency: state.currency,
    totalAmount: state.totalAmount,
    outstandingAmount:
      state.outstandingAmount ?? state.totalAmount,
    issuedAt: state.issuedAt,
    dueDate: state.dueDate ?? null,
  };
}

/**
 * GET /api/ar/invoices/:invoiceId
 *
 * Returns the reconstructed invoice
 * as a stable read projection.
 */
router.get('/invoices/:invoiceId', async (req: Request, res: Response) => {
  try {
    const { invoiceId } = req.params;

    if (!invoiceId) {
      return res.status(400).json({ error: 'invoiceId is required' });
    }

    const pool = getPostgresPool();
    const repo = new PostgresARInvoiceEventRepository(pool);

    const events = await repo.listByInvoice(invoiceId);

    if (events.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const state = events.reduce(applyARInvoiceEvent, undefined as any);
    const projection = projectInvoice(invoiceId, state);

    res.status(200).json({ invoice: projection });
  } catch (err: any) {
    res.status(503).json({
      error: 'AR invoice read unavailable',
      reason: err?.message ?? 'infrastructure error',
    });
  }
});

/**
 * GET /api/ar/invoices/:invoiceId/events
 *
 * Immutable audit stream
 */
router.get('/invoices/:invoiceId/events', async (req: Request, res: Response) => {
  try {
    const { invoiceId } = req.params;

    if (!invoiceId) {
      return res.status(400).json({ error: 'invoiceId is required' });
    }

    const pool = getPostgresPool();
    const repo = new PostgresARInvoiceEventRepository(pool);

    const events = await repo.listByInvoice(invoiceId);

    if (events.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    res.status(200).json({ invoiceId, events });
  } catch (err: any) {
    res.status(503).json({
      error: 'AR invoice events unavailable',
      reason: err?.message ?? 'infrastructure error',
    });
  }
});

export default router;
