import { ReportingQueryImpl } from '@bms/core/src/reporting/queries/ReportingQueryImpl';
import { SnapshotGenerationService } from '@bms/core/src/reporting/services/SnapshotGenerationService';

import { InvoiceRepositoryAdapter } from './InvoiceRepositoryAdapter';
import { PostgresReportingSnapshotRepository } from './PostgresReportingSnapshotRepository';
import { PostgresFinancialPeriodRepository } from './PostgresFinancialPeriodRepository';
import { getPostgresPool } from '../db/PostgresClient';

/**
 * Period lock guard.
 *
 * This is the SINGLE authoritative enforcement seam for
 * financial period governance during snapshot generation.
 */
export interface PeriodLockGuard {
  assertSnapshotGenerationAllowed(params: {
    periodFrom: Date;
    periodTo: Date;
    asOf: Date;
  }): Promise<void>;
}

/**
 * Enforces CLOSED-period rejection using persisted financial periods.
 */
class DatabaseBackedPeriodLockGuard implements PeriodLockGuard {
  constructor(
    private readonly financialPeriodRepository: PostgresFinancialPeriodRepository
  ) {}

  async assertSnapshotGenerationAllowed(params: {
    periodFrom: Date;
    periodTo: Date;
    asOf: Date;
  }): Promise<void> {
    const latest = await this.financialPeriodRepository.getLatestForPeriod({
      periodFrom: params.periodFrom,
      periodTo: params.periodTo,
    });

    if (latest && latest.state === 'CLOSED') {
      throw new Error(
        `Financial period ${params.periodFrom.toISOString()} → ${params.periodTo.toISOString()} is CLOSED`
      );
    }
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
  const pool = getPostgresPool();

  const invoiceRepository = new InvoiceRepositoryAdapter();
  const reportingQuery = new ReportingQueryImpl(invoiceRepository);

  const snapshotRepository = new PostgresReportingSnapshotRepository(pool);

  const financialPeriodRepository =
    new PostgresFinancialPeriodRepository(pool);

  const periodLockGuard: PeriodLockGuard =
    new DatabaseBackedPeriodLockGuard(financialPeriodRepository);

  const snapshotService = new SnapshotGenerationService(
    reportingQuery,
    snapshotRepository
  );

  const guardedSnapshotService = {
    async generate(params: {
      snapshotId: string;
      periodFrom: Date;
      periodTo: Date;
      asOf: Date;
    }) {
      await periodLockGuard.assertSnapshotGenerationAllowed({
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
