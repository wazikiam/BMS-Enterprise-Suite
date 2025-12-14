// packages/server/src/routes/reporting/index.ts

import { Router, Request, Response } from 'express';
import { createReportingQuery } from '../../api/reportingProvider';

/**
 * Reporting routes.
 * Thin HTTP layer: validation + delegation only.
 */
export const reportingRouter = Router();

/**
 * GET /reporting/kpis
 * Query params:
 *  - from (ISO date)
 *  - to (ISO date)
 */
reportingRouter.get('/kpis', async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({
        error: 'Query parameters "from" and "to" are required (ISO dates)',
      });
    }

    const fromDate = new Date(String(from));
    const toDate = new Date(String(to));

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return res.status(400).json({
        error: 'Invalid date format. Use ISO strings.',
      });
    }

    const reportingQuery = createReportingQuery();

    const sales = await reportingQuery.getSalesKPIs({
      from: fromDate,
      to: toDate,
    });

    const ar = await reportingQuery.getARKPIs(new Date());

    return res.json({
      generatedAt: new Date().toISOString(),
      sales,
      accountsReceivable: ar,
    });
  } catch (err) {
    console.error('[Reporting API]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
