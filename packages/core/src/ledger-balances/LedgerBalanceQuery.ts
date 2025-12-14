// packages/core/src/ledger-balances/LedgerBalanceQuery.ts

import { LedgerBalance } from './LedgerBalance';

/**
 * LedgerBalanceQuery
 *
 * Application-facing read interface.
 *
 * This sits ABOVE repositories and BELOW delivery layers.
 * It enforces deterministic querying semantics.
 */
export interface LedgerBalanceQuery {
  /**
   * Get balance for a single account.
   */
  getAccountBalance(params: {
    accountId: string;
    currency: string;
    asOf: Date;
  }): Promise<LedgerBalance>;

  /**
   * Get balances for multiple accounts.
   */
  getAccountBalances(params: {
    accountIds: string[];
    currency: string;
    asOf: Date;
  }): Promise<LedgerBalance[]>;
}
