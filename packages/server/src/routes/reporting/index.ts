// packages/server/src/routes/reporting/index.ts

import { Router, Request, Response } from 'express';
import { createReportingQuery } from '../../api/reportingProvider';

type ErrorResponse = {
  error: {
    code: 'INVALID_REQUEST' | 'INTERNAL_ERROR';
    message: string;
    details?: {
      field: string;
      reason: string;
    };
  };
};

function badRequest(
  res: Response,
  field: string,
  reason: string,
  message = 'Invalid request'
): Response<ErrorResponse> {
  return res.status(400).json({
    error: {
      code: 'INVALID_REQUEST',
      message,
      details: { field, reason },
    },
  });
}

function internalError(res: Response): Response<ErrorResponse> {
  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    },
  });
}

const MAX_RANGE_DAYS = 366;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

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

    // 1) Presence
    if (!from) {
      return badRequest(res, 'from', 'missing', '"from" query parameter is required');
    }
    if (!to) {
      return badRequest(res, 'to', 'missing', '"to" query parameter is required');
    }

    // 2) Format
    const fromDate = new Date(String(from));
    if (isNaN(fromDate.getTime())) {
      return badRequest(res, 'from', 'invalid_format', '"from" must be a valid ISO date');
    }

    const toDate = new Date(String(to));
    if (isNaN(toDate.getTime())) {
      return badRequest(res, 'to', 'invalid_format', '"to" must be a valid ISO date');
    }

    // 3) Logical consistency
    if (fromDate.getTime() > toDate.getTime()) {
      return badRequest(res, 'from', 'after_to', '"from" must be before or equal to "to"');
    }

    // 4) Range safety
    const rangeDays = Math.ceil(
      (toDate.getTime() - fromDate.getTime()) / MS_PER_DAY
    );

    if (rangeDays > MAX_RANGE_DAYS) {
      return badRequest(
        res,
        'range',
        'too_large',
        `Date range must not exceed ${MAX_RANGE_DAYS} days`
      );
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
    return internalError(res);
  }
});
