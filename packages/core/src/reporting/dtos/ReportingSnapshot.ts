// packages/core/src/reporting/dtos/ReportingSnapshot.ts

import { SalesKPIs } from './SalesKPIs';
import { ARKPIs } from './ARKPIs';

/**
 * ReportingSnapshot represents a consistent reporting view
 * generated at a specific point in time.
 */
export interface ReportingSnapshot {
  /** Time when the snapshot was generated */
  generatedAt: Date;

  /** Aggregated sales KPIs */
  sales: SalesKPIs;

  /** Accounts Receivable KPIs */
  accountsReceivable: ARKPIs;
}
