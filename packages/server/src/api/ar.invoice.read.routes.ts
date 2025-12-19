// packages/server/src/api/ar.invoice.read.routes.ts
// ACCOUNTS RECEIVABLE — INVOICE READ API
//
// - Read-only
// - Deterministic
// - Event-sourced
// - Derived strictly from ar_invoice_events
// - No ledger coupling
// - Governance-safe

import { Router, Request, Response } from 'express';
import { getPostgresPool } from '../db/PostgresClient';
import { PostgresARInvoiceEventRepository } from '../ar/PostgresARInvoiceEventRepository';
import { applyARInvoiceEvent } from '@bms/core/src/ar/AccountsReceivable';

const router = Router();

/**
 * GET /api/ar/invoices/:invoiceId
 *
 * Returns the reconstructed invoice state
 * derived from the append-only event stream.
 */
router.get('/invoices/:invoiceId', async (req: Request, res: Response) => {
  try {
    const { invoiceId } = req.params;

    if (!invoiceId) {
      return res.status(400).json({
        error: 'invoiceId is required',
      });
    }

    const pool = getPostgresPool();
    const repo = new PostgresARInvoiceEventRepository(pool);

    const events = await repo.listByInvoice(invoiceId);

    if (events.length === 0) {
      return res.status(404).json({
        error: 'Invoice not found',
      });
    }

    const invoice = events.reduce(applyARInvoiceEvent, undefined as any);

    res.status(200).json({
      invoice,
    });
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
 * Returns the full immutable event stream
 * for audit and troubleshooting.
 */
router.get('/invoices/:invoiceId/events', async (req: Request, res: Response) => {
  try {
    const { invoiceId } = req.params;

    if (!invoiceId) {
      return res.status(400).json({
        error: 'invoiceId is required',
      });
    }

    const pool = getPostgresPool();
    const repo = new PostgresARInvoiceEventRepository(pool);

    const events = await repo.listByInvoice(invoiceId);

    if (events.length === 0) {
      return res.status(404).json({
        error: 'Invoice not found',
      });
    }

    res.status(200).json({
      invoiceId,
      events,
    });
  } catch (err: any) {
    res.status(503).json({
      error: 'AR invoice events unavailable',
      reason: err?.message ?? 'infrastructure error',
    });
  }
});

export default router;
