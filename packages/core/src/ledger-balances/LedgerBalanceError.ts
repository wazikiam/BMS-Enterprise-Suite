// packages/core/src/ledger-balances/LedgerBalanceError.ts

/**
 * LedgerBalanceError
 *
 * Raised when balance aggregation invariants are violated.
 *
 * This indicates corrupted ledger data or a broken projection,
 * NOT a recoverable runtime condition.
 */
export class LedgerBalanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LedgerBalanceError';
  }
}
