// packages/core/src/reporting/queries/ReportingQuery.ts

import { SalesKPIs } from '../dtos/SalesKPIs';
import { ARKPIs } from '../dtos/ARKPIs';

/**
 * ReportingQuery defines the read-side contract for analytics and KPIs.
 * Implementations must be read-only and derived from immutable data.
 */
export interface ReportingQuery {
  /**
   * Compute aggregated sales KPIs for a given time range.
   */
  getSalesKPIs(params: {
    from: Date;
    to: Date;
  }): Promise<SalesKPIs>;

  /**
   * Compute Accounts Receivable KPIs at a specific point in time.
   */
  getARKPIs(asOf: Date): Promise<ARKPIs>;
}
