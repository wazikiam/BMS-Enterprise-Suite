// packages/server/src/api/ar.customer.summary.read.routes.ts
// ACCOUNTS RECEIVABLE — CUSTOMER SUMMARY (READ MODEL)
//
// Phase 4.8 — Customer AR Summary
//
// - Read-only
// - Deterministic
// - Event-sourced
// - Audit-safe
// - Currency-aware (never sum across currencies)
//
// Endpoint:
//   GET /api/ar/customers/:customerId/summary
//
// Response (one per currency):
// {
//   customerId: string,
//   currency: string,
//   invoiceCount: number,
//   totalInvoicedMinor: number,
//   totalPaidMinor: number,
//   outstandingMinor: number
// }

import { Router, Request, Response } from 'express';
import { getPostgresPool } from '../db/PostgresClient';
import { PostgresARInvoiceEventRepository } from '../ar/PostgresARInvoiceEventRepository';
import { applyARInvoiceEvent } from '@bms/core/src/ar/AccountsReceivable';

const router = Router();

type CurrencySummary = {
  customerId: string;
  currency: string;
  invoiceCount: number;
  totalInvoicedMinor: number;
  totalPaidMinor: number;
  outstandingMinor: number;
};

function assertFiniteNonNegativeInt(n: number, name: string): void {
  if (!Number.isFinite(n) || n < 0 || Math.floor(n) !== n) {
    throw new Error(`${name} must be a finite non-negative integer`);
  }
}

/**
 * Convert a decimal string amount (major units) into minor units deterministically.
 * Example: "1250.00" -> 125000
 * Supports up to 6 decimals (matches numeric(18,6) usage elsewhere).
 */
function decimalStringToMinor(amount: unknown, name: string): number {
  if (typeof amount !== 'string') {
    throw new Error(`${name} must be a string`);
  }

  const s = amount.trim();
  if (!/^-?\d+(\.\d+)?$/.test(s)) {
    throw new Error(`${name} must be a decimal string`);
  }

  if (s.startsWith('-')) {
    throw new Error(`${name} must be non-negative`);
  }

  const [intPart, fracPartRaw = ''] = s.split('.');
  const fracPart = fracPartRaw.slice(0, 6); // support up to 6 decimals
  const fracPadded = (fracPart + '000000').slice(0, 6);

  // Interpret as micro-units then scale to minor (2 decimals) conservatively:
  // We treat AR totals as currency amounts; minor = 2 decimals.
  // If inputs have more than 2 decimals, we round to nearest cent deterministically.
  const micro = BigInt(intPart) * 1_000_000n + BigInt(fracPadded);

  // Round micro -> minor (cent) : divide by 10_000 (because 1e6 / 1e2 = 1e4)
  const q = micro / 10_000n;
  const r = micro % 10_000n;
  const rounded = r >= 5_000n ? q + 1n : q;

  const out = Number(rounded);
  assertFiniteNonNegativeInt(out, `${name} (minor)`);
  return out;
}

type InvoiceCreatedFact = {
  invoiceId: string;
  customerId: string;
  currency: string;
  totalAmountMinor: number;
};

type InvoiceStateLight = {
  invoiceId: string;
  status: 'DRAFT' | 'ISSUED' | 'VOIDED';
  totalAmount: string;
};

function mapInvoiceRecordToDomainEvent(record: any): any {
  const payload = record.payload ?? {};

  if (record.eventType === 'AR_INVOICE_CREATED') {
    return {
      type: 'AR_INVOICE_CREATED',
      invoiceId: record.invoiceId,
      customerId: payload.customerId,
      currency: payload.currency,
      totalAmount: payload.totalAmount,
      occurredAt: record.eventTime,
    };
  }

  if (record.eventType === 'AR_INVOICE_ISSUED') {
    return {
      type: 'AR_INVOICE_ISSUED',
      invoiceId: record.invoiceId,
      issuedAt: new Date(payload.issuedAt),
      occurredAt: record.eventTime,
    };
  }

  if (record.eventType === 'AR_INVOICE_VOIDED') {
    return {
      type: 'AR_INVOICE_VOIDED',
      invoiceId: record.invoiceId,
      reason: payload.reason ?? 'voided',
      occurredAt: record.eventTime,
    };
  }

  throw new Error(`Unsupported AR invoice event type: ${record.eventType}`);
}

/**
 * GET /api/ar/customers/:customerId/summary
 */
router.get('/customers/:customerId/summary', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const pool = getPostgresPool();

    // ─────────────────────────────────────────────────────────
    // 1) Derive invoice ownership + totals per currency
    //    Source: AR invoice events (event-sourced)
    // ─────────────────────────────────────────────────────────

    const invoiceRepo = new PostgresARInvoiceEventRepository(pool);
    const all = await invoiceRepo.listAllEvents();

    // Group invoice event records by invoiceId
    const byInvoice = new Map<string, any[]>();
    for (const r of all) {
      const arr = byInvoice.get(r.invoiceId) ?? [];
      arr.push(r);
      byInvoice.set(r.invoiceId, arr);
    }

    // Build invoice states and filter by customerId
    const invoiceFacts: InvoiceCreatedFact[] = [];

    for (const [invoiceId, records] of byInvoice.entries()) {
      // records are already ordered by repo (invoice_id ASC, event_time ASC)
      let state: InvoiceStateLight | undefined = undefined;

      // Track customer/currency from creation
      let createdCustomerId: string | null = null;
      let createdCurrency: string | null = null;

      for (const rec of records) {
        const event = mapInvoiceRecordToDomainEvent(rec);

        // applyARInvoiceEvent returns a minimal state (invoiceId/status/issuedAt/totalAmount)
        state = applyARInvoiceEvent(state as any, event) as any;

        if (event.type === 'AR_INVOICE_CREATED') {
          createdCustomerId = event.customerId;
          createdCurrency = event.currency;
        }
      }

      // Must have creation (ownership)
      if (!createdCustomerId || !createdCurrency || !state) continue;

      if (createdCustomerId !== customerId) continue;

      // Exclude VOIDED invoices entirely from customer totals
      if (state.status === 'VOIDED') continue;

      const totalAmountMinor = decimalStringToMinor(state.totalAmount, `invoice ${invoiceId} totalAmount`);
      invoiceFacts.push({
        invoiceId,
        customerId: createdCustomerId,
        currency: createdCurrency,
        totalAmountMinor,
      });
    }

    // If no invoices, return empty array (currency-aware)
    if (invoiceFacts.length === 0) {
      return res.json({ customerId, summaries: [] as CurrencySummary[] });
    }

    // Compute invoiced totals per currency
    const invoicedByCurrency = new Map<string, { invoiceIds: Set<string>; totalInvoicedMinor: number }>();
    for (const inv of invoiceFacts) {
      const slot = invoicedByCurrency.get(inv.currency) ?? {
        invoiceIds: new Set<string>(),
        totalInvoicedMinor: 0,
      };
      slot.invoiceIds.add(inv.invoiceId);
      slot.totalInvoicedMinor += inv.totalAmountMinor;
      invoicedByCurrency.set(inv.currency, slot);
    }

    // ─────────────────────────────────────────────────────────
    // 2) Compute payments applied to those invoices per currency
    //    Source: ar_payment_events (append-only)
    // ─────────────────────────────────────────────────────────

    // Build invoice set for SQL IN filter
    const invoiceIds = invoiceFacts.map((x) => x.invoiceId);

    // Parameterize array safely
    const paymentRows = await pool.query(
      `
      SELECT
        invoice_id,
        event_type,
        amount_minor,
        currency
      FROM public.ar_payment_events
      WHERE invoice_id = ANY ($1::uuid[])
      ORDER BY recorded_at ASC
      `,
      [invoiceIds]
    );

    // Sum payments per currency:
    // - AR_PAYMENT_RECORDED => +amount
    // - AR_PAYMENT_REVERSED => -amount
    const paidByCurrency = new Map<string, number>();

    for (const row of paymentRows.rows) {
      const ccy = row.currency as string;
      const amt = Number(row.amount_minor);

      if (!Number.isFinite(amt) || amt < 0) {
        throw new Error('Invalid payment amount_minor in storage');
      }

      if (row.event_type === 'AR_PAYMENT_RECORDED') {
        paidByCurrency.set(ccy, (paidByCurrency.get(ccy) ?? 0) + amt);
      } else if (row.event_type === 'AR_PAYMENT_REVERSED') {
        paidByCurrency.set(ccy, (paidByCurrency.get(ccy) ?? 0) - amt);
      } else {
        // Unknown payment types must not be silently ignored
        throw new Error(`Unsupported AR payment event type: ${row.event_type}`);
      }
    }

    // ─────────────────────────────────────────────────────────
    // 3) Produce summaries per currency
    // ─────────────────────────────────────────────────────────

    const summaries: CurrencySummary[] = [];

    for (const [currency, invAgg] of invoicedByCurrency.entries()) {
      const totalInvoicedMinor = invAgg.totalInvoicedMinor;
      const totalPaidMinorRaw = paidByCurrency.get(currency) ?? 0;

      // Clamp to [0, invoiced] for presentation; do not allow negative.
      const totalPaidMinor = Math.max(totalPaidMinorRaw, 0);
      const outstandingMinor = Math.max(totalInvoicedMinor - totalPaidMinor, 0);

      summaries.push({
        customerId,
        currency,
        invoiceCount: invAgg.invoiceIds.size,
        totalInvoicedMinor,
        totalPaidMinor,
        outstandingMinor,
      });
    }

    return res.json({
      customerId,
      summaries,
    });
  } catch (err: any) {
    return res.status(503).json({
      error: 'AR customer summary read unavailable',
      reason: err?.message ?? 'infrastructure error',
    });
  }
});

export default router;
