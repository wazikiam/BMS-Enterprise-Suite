// packages/core/src/ledger-balances/LedgerBalanceCalculator.ts

import { LedgerEntry } from '../domain/ledger/LedgerEntry';
import { LedgerSide } from '../domain/ledger/LedgerSide';
import { LedgerBalance } from './LedgerBalance';
import { LedgerBalanceError } from './LedgerBalanceError';

/**
 * LedgerBalanceCalculator
 *
 * Pure deterministic aggregation logic.
 *
 * Rules:
 * - Operates on immutable LedgerEntry facts
 * - Filters by accountCode, currency, and asOf
 * - Debit increases balance
 * - Credit decreases balance
 * - NEVER infers "current" without asOf
 */
export class LedgerBalanceCalculator {
  static calculate(params: {
    accountCode: string;
    currency: string;
    asOf: Date;
    entries: readonly LedgerEntry[];
  }): LedgerBalance {
    let debitTotal = 0;
    let creditTotal = 0;

    for (const entry of params.entries) {
      if (entry.accountCode !== params.accountCode) continue;
      if (entry.currency !== params.currency) continue;
      if (entry.occurredAt > params.asOf) continue;

      if (entry.side === LedgerSide.DEBIT) {
        debitTotal += entry.amount;
      } else if (entry.side === LedgerSide.CREDIT) {
        creditTotal += entry.amount;
      } else {
        throw new LedgerBalanceError(
          `Unknown ledger side '${(entry as any).side}'`
        );
      }
    }

    const balance = debitTotal - creditTotal;

    if (!Number.isFinite(balance)) {
      throw new LedgerBalanceError('Computed balance is not finite');
    }

    return {
      accountId: params.accountCode,
      currency: params.currency,
      debitTotal,
      creditTotal,
      balance,
      asOf: params.asOf,
    };
  }
}
