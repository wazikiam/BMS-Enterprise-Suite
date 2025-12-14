// packages/core/src/ledger-balances/LedgerBalanceRepository.ts

import { LedgerBalance } from './LedgerBalance';

/**
 * LedgerBalanceRepository (READ MODEL CONTRACT)
 *
 * Read-only projection over immutable ledger postings.
 *
 * Implementations MUST:
 * - Be deterministic
 * - Be read-only
 * - Never cache mutable state
 * - Never infer "current" without asOf
 */
export interface ILedgerBalanceRepository {
  /**
   * Resolve balance for a single account as-of a point in time.
   */
  getAccountBalance(params: {
    accountId: string;
    currency: string;
    asOf: Date;
  }): Promise<LedgerBalance>;

  /**
   * Resolve balances for multiple accounts as-of a point in time.
   */
  getAccountBalances(params: {
    accountIds: string[];
    currency: string;
    asOf: Date;
    }): Promise<LedgerBalance[]>;
}
