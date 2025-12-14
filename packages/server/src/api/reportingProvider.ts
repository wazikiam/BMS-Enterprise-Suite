// packages/server/src/api/reportingProvider.ts

import { ReportingQueryImpl } from '@bms/core/src/reporting/queries/ReportingQueryImpl';
import { SnapshotGenerationService } from '@bms/core/src/reporting/services/SnapshotGenerationService';

import { InvoiceRepositoryAdapter } from './InvoiceRepositoryAdapter';
import { PostgresReportingSnapshotRepository } from './PostgresReportingSnapshotRepository';
import { PostgresFinancialPeriodRepository } from './PostgresFinancialPeriodRepository';
import { FinancialPeriodReadModel } from './FinancialPeriodReadModel';
import { getPostgresPool } from '../db/PostgresClient';

/**
 * PeriodLockGuard
 *
 * Single authoritative enforcement seam for financial period governance
 * during snapshot generation.
 */
export interface PeriodLockGuard {
  assertSnapshotGenerationAllowed(params: {
    periodFrom: Date;
    periodTo: Date;
    asOf: Date;
  }): Promise<void>;
}

/**
 * Database-backed period governance.
 *
 * Rules:
 * - If NO financial period exists for (period_start, period_end) => allow (ungoverned)
 * - If effective state is CLOSED => reject
 * - OPEN / REOPENED => allow
 *
 * Determinism is guaranteed by:
 * - Append-only financial_periods
 * - Repository determinism checks (ambiguous max(created_at) => error)
 * - Read-model centralization (single interpretation point)
 */
class DatabaseBackedPeriodLockGuard implements PeriodLockGuard {
  constructor(private readonly periodReadModel: FinancialPeriodReadModel) {}

  async assertSnapshotGenerationAllowed(params: {
    periodFrom: Date;
    periodTo: Date;
    asOf: Date;
  }): Promise<void> {
    const effective = await this.periodReadModel.resolveEffectivePeriod({
      periodFrom: params.periodFrom,
      periodTo: params.periodTo,
    });

    // Ungoverned period => allowed (explicit)
    if (!effective) return;

    if (effective.state === 'CLOSED') {
      throw new Error(
        `Financial period ${effective.periodStart.toISOString()} -> ${effective.periodEnd.toISOString()} is CLOSED`
      );
    }
  }
}

/**
 * ReportingProvider
 *
 * Application boundary for reporting.
 * - Composes read models
 * - Orchestrates snapshot generation
 * - Enforces governance rules
 *
 * No HTTP. No framework logic.
 */
export function createReportingProvider() {
  const pool = getPostgresPool();

  // Read models
  const invoiceRepository = new InvoiceRepositoryAdapter();
  const reportingQuery = new ReportingQueryImpl(invoiceRepository);

  // Persistence
  const snapshotRepository = new PostgresReportingSnapshotRepository(pool);
  const financialPeriodRepository = new PostgresFinancialPeriodRepository(pool);

  // Period read model (single deterministic interpretation point)
  const financialPeriodReadModel = new FinancialPeriodReadModel(
    financialPeriodRepository
  );

  // Governance
  const periodLockGuard: PeriodLockGuard = new DatabaseBackedPeriodLockGuard(
    financialPeriodReadModel
  );

  // Snapshot orchestration (core service remains unaware of governance)
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
