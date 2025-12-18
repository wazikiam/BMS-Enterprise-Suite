// packages/core/src/ledger-balances/LedgerBalanceQueryImpl.ts

import { LedgerBalance } from './LedgerBalance';
import { ILedgerBalanceRepository } from './LedgerBalanceRepository';

/**
 * LedgerBalanceQueryImpl
 *
 * Pure application-layer query.
 *
 * Responsibilities:
 * - Delegate to deterministic read-model repository
 * - Enforce explicit as-of semantics
 *
 * Guarantees:
 * - No writes
 * - No side effects
 * - No balance math
 * - No domain leakage
 */
export class LedgerBalanceQueryImpl {
  constructor(
    private readonly repository: ILedgerBalanceRepository
  ) {}

  /**
   * Resolve balance for a single account.
   */
  async getAccountBalance(params: {
    accountId: string;
    currency: string;
    asOf: Date;
  }): Promise<LedgerBalance> {
    return this.repository.getAccountBalance({
      accountId: params.accountId,
      currency: params.currency,
      asOf: params.asOf,
    });
  }

  /**
   * Resolve balances for multiple accounts.
   */
  async getAccountBalances(params: {
    accountIds: string[];
    currency: string;
    asOf: Date;
  }): Promise<LedgerBalance[]> {
    return this.repository.getAccountBalances({
      accountIds: params.accountIds,
      currency: params.currency,
      asOf: params.asOf,
    });
  }
}
