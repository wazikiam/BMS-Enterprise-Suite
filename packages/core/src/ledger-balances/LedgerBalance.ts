// packages/core/src/ledger-balances/LedgerBalance.ts

/**
 * LedgerBalance
 *
 * Immutable, derived read model.
 *
 * Represents the balance of a single account
 * as-of a specific point in time.
 *
 * This is NOT stored directly.
 * It is ALWAYS derived from ledger postings.
 */
export interface LedgerBalance {
  accountId: string;
  currency: string;

  debitTotal: number;
  creditTotal: number;

  balance: number;

  asOf: Date;
}
