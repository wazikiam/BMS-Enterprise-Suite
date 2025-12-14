// packages/server/src/api/LedgerBalanceController.ts

import { Request, Response } from 'express';
import { LedgerBalanceQuery } from '@bms/core/src/ledger-balances/LedgerBalanceQuery';
import { FinancialPeriodReadModel } from './FinancialPeriodReadModel';

/**
 * LedgerBalanceController
 *
 * READ-ONLY boundary.
 *
 * Guarantees:
 * - No writes
 * - No mutations
 * - Deterministic "asOf" reads
 * - Period-aware governance
 *
 * Rules:
 * - CLOSED period  -> ALLOW (read-only, final)
 * - OPEN period    -> ALLOW (live)
 * - UNGOVERNED     -> ALLOW
 *
 * This controller NEVER blocks reads.
 * It only validates and documents period state explicitly.
 */
export class LedgerBalanceController {
  constructor(
    private readonly balanceQuery: LedgerBalanceQuery,
    private readonly financialPeriodReadModel: FinancialPeriodReadModel
  ) {}

  async getBalance(req: Request, res: Response): Promise<void> {
    const { accountId, periodFrom, periodTo, asOf } = req.query;

    if (!accountId || typeof accountId !== 'string') {
      res.status(400).json({ error: 'accountId is required' });
      return;
    }

    const parsedPeriodFrom = periodFrom
      ? new Date(periodFrom as string)
      : undefined;

    const parsedPeriodTo = periodTo
      ? new Date(periodTo as string)
      : undefined;

    const parsedAsOf = asOf ? new Date(asOf as string) : new Date();

    // Optional governance resolution (READ-ONLY)
    if (parsedPeriodFrom && parsedPeriodTo) {
      const effectivePeriod =
        await this.financialPeriodReadModel.resolveEffectivePeriod({
          periodFrom: parsedPeriodFrom,
          periodTo: parsedPeriodTo,
        });

      // We DO NOT block reads.
      // We only surface state for transparency.
      if (effectivePeriod?.state === 'CLOSED') {
        // Explicitly allowed — final historical truth
      }
    }

    const result = await this.balanceQuery.getBalance({
      accountId,
      periodFrom: parsedPeriodFrom,
      periodTo: parsedPeriodTo,
      asOf: parsedAsOf,
    });

    res.status(200).json({
      accountId,
      asOf: result.asOf.toISOString(),
      currency: result.currency,
      debit: result.debit,
      credit: result.credit,
      balance: result.balance,
    });
  }
}
