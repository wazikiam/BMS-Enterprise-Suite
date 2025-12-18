// packages/server/src/api/PostgresReportingSnapshotRepository.ts

import { IReportingSnapshotRepository } from '@bms/core/src/reporting/repositories/ReportingSnapshotRepository';
import { ReportingSnapshot } from '@bms/core/src/reporting/dtos/ReportingSnapshot';

/**
 * POSTGRES DISABLED — WEEK 20
 *
 * This stub exists ONLY to satisfy imports.
 * It must never be instantiated or used.
 */
export class PostgresReportingSnapshotRepository
  implements IReportingSnapshotRepository
{
  constructor() {
    throw new Error(
      'PostgresReportingSnapshotRepository is DISABLED (Week 20)'
    );
  }

  async append(_snapshot: ReportingSnapshot): Promise<void> {
    throw new Error('Postgres disabled');
  }

  async getById(_snapshotId: string): Promise<ReportingSnapshot | null> {
    throw new Error('Postgres disabled');
  }

  async getLatest(): Promise<ReportingSnapshot | null> {
    throw new Error('Postgres disabled');
  }

  async list(): Promise<ReportingSnapshot[]> {
    throw new Error('Postgres disabled');
  }
}
