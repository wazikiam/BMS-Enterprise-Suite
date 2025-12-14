// packages/core/src/reporting/dtos/SalesKPIs.ts

/**
 * Aggregated sales metrics derived from finalized sales documents.
 * All values are computed from immutable financial records.
 */
export interface SalesKPIs {
  /** Sum of all invoice totals in the period */
  totalSalesAmount: number;

  /** Count of issued invoices */
  totalInvoices: number;

  /** Average invoice monetary value */
  averageInvoiceValue: number;

  /** Number of fully paid invoices */
  paidInvoices: number;

  /** Number of unpaid or partially paid invoices */
  unpaidInvoices: number;
}
