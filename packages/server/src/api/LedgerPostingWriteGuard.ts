// packages/server/src/api/LedgerPostingWriteGuard.ts

import { LedgerPosting } from '@bms/core/src/domain/ledger/LedgerPosting';
import { FinancialPeriodReadModel } from './FinancialPeriodReadModel';

/**
 * LedgerPostingWriteGuard
 *
 * Application-boundary write barrier.
 *
 * Enforces that NO ledger posting may be appended
 * into a CLOSED financial period.
 *
 * This guard:
 * - Does NOT mutate data
 * - Does NOT calculate balances
 * - Does NOT touch persistence
 * - Operates deterministically
 */
export class LedgerPostingWriteGuard {
  constructor(
    private readonly financialPeriodReadModel: FinancialPeriodReadModel
  ) {}

  async assertCanPost(posting: LedgerPosting): Promise<void> {
    if (posting.entries.length === 0) {
      throw new Error('Ledger posting contains no entries');
    }

    // LedgerPosting constructor already enforces
    // that all entries share the same period
    const firstEntry = posting.entries[0];

    const effectivePeriod =
      await this.financialPeriodReadModel.resolveEffectivePeriod({
        periodFrom: firstEntry.periodStart,
        periodTo: firstEntry.periodEnd,
      });

    // No governance yet → allowed explicitly
    if (!effectivePeriod) return;

    if (effectivePeriod.state === 'CLOSED') {
      throw new Error(
        `Ledger posting rejected: financial period ` +
          `${firstEntry.periodStart.toISOString()} -> ` +
          `${firstEntry.periodEnd.toISOString()} is CLOSED`
      );
    }
  }
}
