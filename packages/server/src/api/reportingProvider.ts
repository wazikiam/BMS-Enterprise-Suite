// packages/server/src/api/reportingProvider.ts

import { ReportingQueryImpl } from '@bms/core/src/reporting/queries/ReportingQueryImpl';
import { SnapshotGenerationService } from '@bms/core/src/reporting/services/SnapshotGenerationService';

import { InvoiceRepositoryAdapter } from './InvoiceRepositoryAdapter';
import { InMemoryReportingSnapshotRepository } from './InMemoryReportingSnapshotRepository';

/**
 * Reporting provider composes reporting read models
 * and snapshot orchestration.
 *
 * No HTTP. No framework logic.
 */
export function createReportingProvider() {
  const invoiceRepository = new InvoiceRepositoryAdapter();

  const reportingQuery = new ReportingQueryImpl(invoiceRepository);

  const snapshotRepository = new InMemoryReportingSnapshotRepository();

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
