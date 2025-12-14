// packages/server/src/api/InMemoryReportingSnapshotRepository.ts

import { ReportingSnapshot } from '@bms/core/src/reporting/dtos/ReportingSnapshot';
import { IReportingSnapshotRepository } from '@bms/core/src/reporting/repositories/ReportingSnapshotRepository';

/**
 * TEMPORARY in-memory implementation.
 *
 * - Append-only
 * - Process-local
 * - Contract-accurate
 */
export class InMemoryReportingSnapshotRepository
  implements IReportingSnapshotRepository
{
  private readonly store: ReportingSnapshot[] = [];

  async append(snapshot: ReportingSnapshot): Promise<void> {
    if (this.store.find(s => s.snapshotId === snapshot.snapshotId)) {
      throw new Error(`Snapshot ${snapshot.snapshotId} already exists`);
    }
    this.store.push(snapshot);
  }

  async getById(snapshotId: string): Promise<ReportingSnapshot | null> {
    return this.store.find(s => s.snapshotId === snapshotId) ?? null;
  }

  async getLatest(): Promise<ReportingSnapshot | null> {
    return this.store.at(-1) ?? null;
  }

  async list(params?: {
    fromGeneratedAt?: Date;
    toGeneratedAt?: Date;
    limit?: number;
  }): Promise<ReportingSnapshot[]> {
    let results = [...this.store];

    if (params?.fromGeneratedAt) {
      results = results.filter(
        s => s.generatedAt >= params.fromGeneratedAt
      );
    }

    if (params?.toGeneratedAt) {
      results = results.filter(
        s => s.generatedAt <= params.toGeneratedAt
      );
    }

    if (params?.limit !== undefined) {
      results = results.slice(-params.limit);
    }

    return results;
  }
}
