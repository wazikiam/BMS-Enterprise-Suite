// packages/server/src/api/TrialBalanceController.ts
// TRIAL BALANCE CONTROLLER (SEALED)
// - Read-only
// - Actor-enforced
// - Deterministic, explicit input contract
// - Historical reads allowed for OPEN and CLOSED periods
// - Fail-closed on infrastructure errors

import { Request, Response } from 'express';
import { PostgresTrialBalanceReadService } from '../services/TrialBalanceReadService';

function parseIsoDate(value: unknown, field: string): Date {
  if (typeof value !== 'string') {
    throw new Error(`${field} must be an ISO date string`);
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`${field} must be a valid ISO date`);
  }
  return d;
}

export class TrialBalanceController {
  constructor(
    private readonly service: PostgresTrialBalanceReadService
  ) {}

  async getTrialBalance(req: Request, res: Response): Promise<void> {
    try {
      // Actor must already be injected by middleware
      const actor = (req as any).actor;
      if (!actor) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      const { periodFrom, periodTo, asOf, currency } = req.query;

      if (typeof currency !== 'string' || currency.length === 0) {
        res.status(400).json({
          error: 'Invalid query parameters',
          reason: 'currency is required',
        });
        return;
      }

      let parsedPeriodFrom: Date;
      let parsedPeriodTo: Date;
      let parsedAsOf: Date;

      try {
        parsedPeriodFrom = parseIsoDate(periodFrom, 'periodFrom');
        parsedPeriodTo = parseIsoDate(periodTo, 'periodTo');
        parsedAsOf = parseIsoDate(asOf, 'asOf');
      } catch (e: any) {
        res.status(400).json({
          error: 'Invalid query parameters',
          reason: e.message,
        });
        return;
      }

      if (parsedPeriodFrom.getTime() > parsedPeriodTo.getTime()) {
        res.status(400).json({
          error: 'Invalid query parameters',
          reason: 'periodFrom must be <= periodTo',
        });
        return;
      }

      // NOTE (EXPLICIT GOVERNANCE):
      // Trial balance is a historical read.
      // Reads are allowed for OPEN and CLOSED periods.
      // No FinancialPeriodGate applies to reads.

      const result = await this.service.getTrialBalance({
        periodFrom: parsedPeriodFrom,
        periodTo: parsedPeriodTo,
        asOf: parsedAsOf,
        currency,
      });

      res.status(200).json({
        period: {
          from: result.period.from.toISOString(),
          to: result.period.to.toISOString(),
          asOf: result.period.asOf.toISOString(),
        },
        currency: result.currency,
        accounts: result.accounts,
      });
    } catch (err: any) {
      // Fail-closed: never return partial data
      res.status(503).json({
        error: 'Trial balance unavailable',
        reason: err?.message ?? 'infrastructure error',
      });
    }
  }
}
