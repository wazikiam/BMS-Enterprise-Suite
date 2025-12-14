// packages/core/src/reporting/dtos/ARKPIs.ts

/**
 * Accounts Receivable metrics derived from AR ledger state.
 * Values represent exposure at a specific point in time.
 */
export interface ARKPIs {
  /** Total outstanding receivables amount */
  totalOutstanding: number;

  /** Amount past due based on payment terms */
  overdueAmount: number;

  /** Number of customers with overdue balances */
  customersOverdue: number;

  /** Average days outstanding across all open receivables */
  averageDaysOutstanding: number;
}
