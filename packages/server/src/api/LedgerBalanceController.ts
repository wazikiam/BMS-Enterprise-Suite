// packages/server/src/api/LedgerBalanceController.ts

import { Request, Response } from 'express';
import { FinancialPeriodReadModel } from './FinancialPeriodReadModel';

/**
 * LedgerBalanceReadPort
 *
 * Explicit read contract expected by this controller.
 * Keeps HTTP isolated from provider internals.
 */
export interface LedgerBalanceReadPort {
  getAccountBalance(params: {
    accountId: string;
    currency: string;
    asOf: Date;
    periodFrom?: Date;
    periodTo?: Date;
  }): Promise<{
    accountId: string;
    currency: string;
    debitTotal: number;
    creditTotal: number;
    balance: number;
    asOf: Date;
  }>;
}

/**
 * LedgerBalanceController
 *
 * READ-ONLY HTTP boundary.
 *
 * Guarantees:
 * - No writes
 * - No mutations
 * - Deterministic as-of reads
 * - Period-aware transparency
 *
 * Reads are NEVER blocked.
 */
export class LedgerBalanceController {
  constructor(
    private readonly balanceQuery: LedgerBalanceReadPort,
    private readonly financialPeriodReadModel: FinancialPeriodReadModel
  ) {}

  async getBalance(req: Request, res: Response): Promise<void> {
    const { accountId, currency, periodFrom, periodTo, asOf } = req.query;

    if (!accountId || typeof accountId !== 'string') {
      res.status(400).json({ error: 'accountId is required' });
      return;
    }

    if (!currency || typeof currency !== 'string') {
      res.status(400).json({ error: 'currency is required' });
      return;
    }

    const parsedPeriodFrom = periodFrom
      ? new Date(periodFrom as string)
      : undefined;

    const parsedPeriodTo = periodTo
      ? new Date(periodTo as string)
      : undefined;

    const parsedAsOf = asOf ? new Date(asOf as string) : new Date();

    // Resolve period state for transparency (READ-ONLY)
    if (parsedPeriodFrom && parsedPeriodTo) {
      await this.financialPeriodReadModel.resolveEffectivePeriod({
        periodFrom: parsedPeriodFrom,
        periodTo: parsedPeriodTo,
      });
    }

    const result = await this.balanceQuery.getAccountBalance({
      accountId,
      currency,
      asOf: parsedAsOf,
      periodFrom: parsedPeriodFrom,
      periodTo: parsedPeriodTo,
    });

    res.status(200).json({
      accountId: result.accountId,
      currency: result.currency,
      asOf: result.asOf.toISOString(),
      debitTotal: result.debitTotal,
      creditTotal: result.creditTotal,
      balance: result.balance,
    });
  }
}
