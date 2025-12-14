// packages/core/src/reporting/dtos/ReportingSnapshot.ts

import { SalesKPIs } from './SalesKPIs';
import { ARKPIs } from './ARKPIs';

/**
 * ReportingSnapshot is an immutable, point-in-time
 * representation of business metrics.
 *
 * Snapshots are append-only and must never be mutated.
 */
export interface ReportingSnapshot {
  /** Stable snapshot identifier */
  snapshotId: string;

  /** Schema version for forward compatibility */
  version: 1;

  /** Time window for sales aggregation */
  period: {
    from: Date;
    to: Date;
  };

  /** Point-in-time reference for AR exposure */
  asOf: Date;

  /** Time when the snapshot was generated */
  generatedAt: Date;

  /** Aggregated sales KPIs */
  sales: SalesKPIs;

  /** Accounts Receivable KPIs */
  accountsReceivable: ARKPIs;
}
