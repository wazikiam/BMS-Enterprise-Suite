// packages/server/src/api/reportingProvider.ts

import { ReportingQueryImpl } from '@bms/core/src/reporting/queries/ReportingQueryImpl';
import { SnapshotGenerationService } from '@bms/core/src/reporting/services/SnapshotGenerationService';

import { InvoiceRepositoryAdapter } from './InvoiceRepositoryAdapter';
import { PostgresReportingSnapshotRepository } from './PostgresReportingSnapshotRepository';
import { getPostgresPool } from '../db/PostgresClient';

/**
 * Reporting provider composes reporting read models
 * and snapshot orchestration.
 *
 * No HTTP. No framework logic.
 */
export function createReportingProvider() {
  const invoiceRepository = new InvoiceRepositoryAdapter();

  const reportingQuery = new ReportingQueryImpl(invoiceRepository);

  const snapshotRepository = new PostgresReportingSnapshotRepository(
    getPostgresPool()
  );

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
