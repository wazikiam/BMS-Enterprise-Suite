// packages/server/src/api/ar.invoice.payments.read.routes.ts
// ACCOUNTS RECEIVABLE — PAYMENTS PER INVOICE (READ MODEL)
//
// Phase 4.7 — Settlement Computation (CORRECT)
// - Read-only
// - Deterministic
// - Event-sourced
// - Audit-safe
// - Invoice total is authoritative (from invoice READ model)

import { Router, Request, Response } from 'express';
import { getPostgresPool } from '../db/PostgresClient';
import { PostgresARInvoiceEventRepository } from '../ar/PostgresARInvoiceEventRepository';
import { applyARInvoiceEvent } from '@bms/core/src/ar/AccountsReceivable';

const router = Router();

/**
 * DB → Domain Event (same as ar.invoice.read.routes.ts)
 */
function mapInvoiceRecordToDomainEvent(row: any): any {
  const payload = row.payload ?? {};

  if (row.eventType === 'AR_INVOICE_CREATED') {
    return {
      type: 'AR_INVOICE_CREATED',
      invoiceId: row.invoiceId,
      customerId: payload.customerId,
      currency: payload.currency,
      totalAmount: payload.totalAmount, // REQUIRED by core
      occurredAt: row.eventTime,
    };
  }

  if (row.eventType === 'AR_INVOICE_ISSUED') {
    return {
      type: 'AR_INVOICE_ISSUED',
      invoiceId: row.invoiceId,
      totalAmount: payload.totalAmount,
      issuedAt: new Date(payload.issuedAt),
      dueDate: payload.dueDate ? new Date(payload.dueDate) : undefined,
      occurredAt: row.eventTime,
    };
  }

  throw new Error(`Unsupported AR invoice event type: ${row.eventType}`);
}

/**
 * GET /api/ar/invoices/:invoiceId/payments
 */
router.get('/invoices/:invoiceId/payments', async (req: Request, res: Response) => {
  try {
    const { invoiceId } = req.params;
    const pool = getPostgresPool();

    // ─────────────────────────────────────────────────────────
    // 1️⃣ Rebuild invoice state (authoritative)
    // ─────────────────────────────────────────────────────────

    const invoiceRepo = new PostgresARInvoiceEventRepository(pool);
    const invoiceRecords = await invoiceRepo.listByInvoice(invoiceId);

    if (invoiceRecords.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    let invoiceState: any = undefined;
    for (const record of invoiceRecords) {
      const event = mapInvoiceRecordToDomainEvent(record);
      invoiceState = applyARInvoiceEvent(invoiceState, event);
    }

    const invoiceTotalMinor: number | null =
      typeof invoiceState?.totalAmount === 'number'
        ? Math.round(invoiceState.totalAmount * 100)
        : null;

    // ─────────────────────────────────────────────────────────
    // 2️⃣ Aggregate applied payments
    // ─────────────────────────────────────────────────────────

    const { rows } = await pool.query(
      `
      SELECT
        payment_id,
        event_type,
        amount_minor,
        currency,
        occurred_at,
        reason
      FROM public.ar_payment_events
      WHERE invoice_id = $1
      ORDER BY occurred_at ASC
      `,
      [invoiceId]
    );

    const payments: {
      paymentId: string;
      amountMinor: number;
      currency: string;
      occurredAt: string;
      reason: string;
    }[] = [];

    let totalPaidMinor = 0;
    let currency: string | null = null;

    for (const row of rows) {
      if (row.event_type === 'AR_PAYMENT_RECORDED') {
        const amt = Number(row.amount_minor);

        payments.push({
          paymentId: row.payment_id,
          amountMinor: amt,
          currency: row.currency,
          occurredAt: row.occurred_at,
          reason: row.reason,
        });

        totalPaidMinor += amt;
        currency = row.currency;
      }

      if (row.event_type === 'AR_PAYMENT_VOIDED') {
        payments.length = 0;
        totalPaidMinor = 0;
      }
    }

    // ─────────────────────────────────────────────────────────
    // 3️⃣ Settlement computation (safe)
    // ─────────────────────────────────────────────────────────

    let remainingMinor: number | null = null;
    let settlementStatus: 'UNPAID' | 'PARTIALLY_SETTLED' | 'SETTLED' = 'UNPAID';

    if (invoiceTotalMinor !== null) {
      remainingMinor = Math.max(invoiceTotalMinor - totalPaidMinor, 0);

      if (totalPaidMinor === 0) {
        settlementStatus = 'UNPAID';
      } else if (remainingMinor === 0) {
        settlementStatus = 'SETTLED';
      } else {
        settlementStatus = 'PARTIALLY_SETTLED';
      }
    }

    res.json({
      invoiceId,
      invoiceTotalMinor,
      totalPaidMinor,
      remainingMinor,
      currency,
      settlementStatus,
      payments,
    });
  } catch (err: any) {
    res.status(503).json({
      error: 'AR invoice payments read unavailable',
      reason: err?.message ?? 'infrastructure error',
    });
  }
});

export default router;
