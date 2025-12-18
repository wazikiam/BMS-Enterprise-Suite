// packages/server/src/api/reportingProvider.ts

import { ReportingQueryImpl } from '@bms/core/src/reporting/queries/ReportingQueryImpl';
import { SnapshotGenerationService } from '@bms/core/src/reporting/services/SnapshotGenerationService';

import { InvoiceRepositoryAdapter } from './InvoiceRepositoryAdapter';
import { sharedReportingSnapshotRepository } from './sharedReportingSnapshotStore';

/**
 * ReportingProvider (Week 21 — READ SIDE)
 *
 * Uses the SHARED snapshot repository so that:
 * - POST /snapshots
 * - GET /snapshots
 * - GET /snapshots/:id
 *
 * all see the same data.
 */
export function createReportingProvider() {
  const invoiceRepository = new InvoiceRepositoryAdapter();
  const reportingQuery = new ReportingQueryImpl(invoiceRepository);

  const snapshotRepository = sharedReportingSnapshotRepository;

  const snapshotService = new SnapshotGenerationService(
    reportingQuery,
    snapshotRepository
  );

  return {
    reportingQuery,
    snapshotService,
    snapshotRepository,
  };
}

export type ReportingProvider = ReturnType<typeof createReportingProvider>;
