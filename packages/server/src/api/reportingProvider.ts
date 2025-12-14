import { ReportingQueryImpl } from '@bms/core/src/reporting/queries/ReportingQueryImpl';
import { SnapshotGenerationService } from '@bms/core/src/reporting/services/SnapshotGenerationService';

import { InvoiceRepositoryAdapter } from './InvoiceRepositoryAdapter';
import { PostgresReportingSnapshotRepository } from './PostgresReportingSnapshotRepository';
import { getPostgresPool } from '../db/PostgresClient';

/**
 * Period lock guard.
 *
 * This is the SINGLE authoritative enforcement seam for
 * financial period governance during snapshot generation.
 *
 * For now, it explicitly allows generation.
 * Future steps will enforce CLOSED period rejection here.
 */
export interface PeriodLockGuard {
  assertSnapshotGenerationAllowed(params: {
    periodFrom: Date;
    periodTo: Date;
    asOf: Date;
  }): void;
}

/**
 * Default guard (Week 14 Step 2).
 *
 * This guard is explicit and intentional.
 * It exists to prevent bypass and to anchor enforcement.
 */
class AllowAllPeriodLockGuard implements PeriodLockGuard {
  assertSnapshotGenerationAllowed(): void {
    // Intentionally allowed.
    // CLOSED period enforcement will be added once periods are persisted.
  }
}

/**
 * Reporting provider composes reporting read models
 * and snapshot orchestration.
 *
 * This is the APPLICATION BOUNDARY for reporting.
 * Governance rules MUST be enforced here.
 */
export function createReportingProvider() {
  const invoiceRepository = new InvoiceRepositoryAdapter();

  const reportingQuery = new ReportingQueryImpl(invoiceRepository);

  const snapshotRepository = new PostgresReportingSnapshotRepository(
    getPostgresPool()
  );

  const periodLockGuard: PeriodLockGuard = new AllowAllPeriodLockGuard();

  const snapshotService = new SnapshotGenerationService(
    reportingQuery,
    snapshotRepository
  );

  /**
   * Guarded snapshot generation.
   *
   * ALL snapshot generation MUST pass through this function.
   */
  const guardedSnapshotService = {
    async generate(params: {
      snapshotId: string;
      periodFrom: Date;
      periodTo: Date;
      asOf: Date;
    }) {
      periodLockGuard.assertSnapshotGenerationAllowed({
        periodFrom: params.periodFrom,
        periodTo: params.periodTo,
        asOf: params.asOf,
      });

      return snapshotService.generate(params);
    },
  };

  return {
    reportingQuery,
    snapshotService: guardedSnapshotService,
    snapshotRepository,
  };
}

export type ReportingProvider = ReturnType<typeof createReportingProvider>;
