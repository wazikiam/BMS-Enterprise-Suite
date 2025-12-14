// packages/server/src/api/LedgerBalanceController.ts

import { Request, Response } from 'express';
import { LedgerBalanceQuery } from '@bms/core/src/ledger-balances/LedgerBalanceQuery';

export class LedgerBalanceController {
  constructor(private readonly balanceQuery: LedgerBalanceQuery) {}

  async getBalance(req: Request, res: Response): Promise<void> {
    const { accountId, periodFrom, periodTo, asOf } = req.query;

    if (!accountId || typeof accountId !== 'string') {
      res.status(400).json({
        error: 'accountId is required',
      });
      return;
    }

    const result = await this.balanceQuery.getBalance({
      accountId,
      periodFrom: periodFrom ? new Date(periodFrom as string) : undefined,
      periodTo: periodTo ? new Date(periodTo as string) : undefined,
      asOf: asOf ? new Date(asOf as string) : new Date(),
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
