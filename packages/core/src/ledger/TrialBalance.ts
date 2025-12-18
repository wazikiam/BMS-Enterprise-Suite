// packages/core/src/ledger/TrialBalance.ts
// TRIAL BALANCE — CANONICAL READ MODEL CONTRACT
//
// Finance Core — Phase 1
// Read-only, deterministic, period-aware, currency-isolated

/**
 * Trial Balance query parameters.
 *
 * Time semantics:
 * - periodFrom / periodTo define accounting period (occurred_at)
 * - asOf defines knowledge cutoff (recorded_at)
 */
export interface TrialBalanceQuery {
  periodFrom: Date;
  periodTo: Date;
  asOf: Date;
  currency: string;
}

/**
 * Single account line in a Trial Balance.
 *
 * All numeric values are represented as strings to preserve precision.
 */
export interface TrialBalanceAccountLine {
  accountCode: string;
  debit: string;
  credit: string;
  balance: string; // debit - credit
}

/**
 * Trial Balance result.
 *
 * This is a pure read model:
 * - Derived exclusively from ledger events
 * - No cached or persisted state
 */
export interface TrialBalanceResult {
  period: {
    from: Date;
    to: Date;
    asOf: Date;
  };
  currency: string;
  accounts: TrialBalanceAccountLine[];
}

/**
 * Trial Balance read service contract.
 *
 * Implementations must:
 * - Be deterministic
 * - Never mutate state
 * - Fail closed on infrastructure errors
 */
export interface TrialBalanceReadService {
  getTrialBalance(
    query: TrialBalanceQuery
  ): Promise<TrialBalanceResult>;
}
