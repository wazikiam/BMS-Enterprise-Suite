// packages/server/src/api/ar.aging.read.routes.ts
// ACCOUNTS RECEIVABLE — AGING READ MODEL
//
// ✔ Read-only
// ✔ SQL-derived projection
// ✔ Event-sourced (indirect)
// ✔ NO domain reducers
// ✔ Governance-safe
// ✔ Deterministic

import { Router, Request, Response } from 'express';
import { getPostgresPool } from '../db/PostgresClient';

const router = Router();

/**
 * GET /api/ar/aging
 *
 * Returns aging buckets for ISSUED invoices only.
 * Projection rules:
 * - Invoice must have AR_INVOICE_CREATED
 * - Invoice must have AR_INVOICE_ISSUED
 * - Invoice must NOT have AR_INVOICE_VOIDED
 */
router.get('/aging', async (_req: Request, res: Response) => {
  try {
    const pool = getPostgresPool();

    const sql = `
      WITH invoice_events AS (
        SELECT
          invoice_id,
          bool_or(event_type = 'AR_INVOICE_CREATED') AS created,
          bool_or(event_type = 'AR_INVOICE_ISSUED') AS issued,
          bool_or(event_type = 'AR_INVOICE_VOIDED') AS voided,
          MIN(event_time) FILTER (WHERE event_type = 'AR_INVOICE_ISSUED') AS issued_at,
          MAX((payload->>'totalAmount')) FILTER (WHERE event_type = 'AR_INVOICE_ISSUED') AS total_amount
        FROM ar_invoice_events
        GROUP BY invoice_id
      )
      SELECT
        invoice_id,
        issued_at,
        total_amount
      FROM invoice_events
      WHERE
        created = true
        AND issued = true
        AND voided = false
        AND issued_at IS NOT NULL
        AND total_amount IS NOT NULL
    `;

    const { rows } = await pool.query(sql);

    const today = new Date();
    const buckets = {
      '0-30': 0,
      '31-60': 0,
      '61-90': 0,
      '90+': 0,
    };

    const invoices = rows.map((r) => {
      const issuedAt = new Date(r.issued_at);
      const ageDays = Math.floor(
        (today.getTime() - issuedAt.getTime()) / 86400000
      );

      let bucket: keyof typeof buckets;
      if (ageDays <= 30) bucket = '0-30';
      else if (ageDays <= 60) bucket = '31-60';
      else if (ageDays <= 90) bucket = '61-90';
      else bucket = '90+';

      const amount = Number(r.total_amount);
      buckets[bucket] += amount;

      return {
        invoiceId: r.invoice_id,
        issuedAt: issuedAt.toISOString(),
        totalAmount: r.total_amount,
        ageDays,
        bucket,
      };
    });

    res.status(200).json({
      asOf: today.toISOString(),
      buckets,
      invoices,
    });
  } catch (err: any) {
    res.status(503).json({
      error: 'AR aging unavailable',
      reason: err?.message ?? 'infrastructure error',
    });
  }
});

export default router;
