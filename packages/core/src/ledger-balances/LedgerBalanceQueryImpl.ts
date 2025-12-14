// packages/core/src/ledger-balances/LedgerBalanceQueryImpl.ts

import { LedgerBalance } from './LedgerBalance';
import { LedgerBalanceCalculator } from './LedgerBalanceCalculator';
import { LedgerBalanceRepository } from './LedgerBalanceRepository';

/**
 * LedgerBalanceQueryImpl
 *
 * Pure application-layer query.
 *
 * Responsibilities:
 * - Load immutable ledger postings from repository
 * - Delegate deterministic aggregation to calculator
 * - Return stable balance snapshot
 *
 * Guarantees:
 * - No writes
 * - No side effects
 * - No infrastructure knowledge
 */
export class LedgerBalanceQueryImpl {
  constructor(
    private readonly repository: LedgerBalanceRepository,
    private readonly calculator: LedgerBalanceCalculator = new LedgerBalanceCalculator()
  ) {}

  /**
   * Compute balances for a single account.
   */
  async getAccountBalance(params: {
    accountId: string;
    asOf?: Date;
  }): Promise<LedgerBalance> {
    const postings = await this.repository.findPostings({
      accountId: params.accountId,
      asOf: params.asOf,
    });

    return this.calculator.calculate({
      accountId: params.accountId,
      postings,
      asOf: params.asOf,
    });
  }

  /**
   * Compute balances for multiple accounts.
   */
  async getBalances(params: {
    accountIds: string[];
    asOf?: Date;
  }): Promise<LedgerBalance[]> {
    const postings = await this.repository.findPostings({
      accountIds: params.accountIds,
      asOf: params.asOf,
    });

    return this.calculator.calculateMany({
      postings,
      asOf: params.asOf,
    });
  }
}
