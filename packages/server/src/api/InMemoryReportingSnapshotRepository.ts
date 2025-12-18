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
    const exists = this.store.some(
      s => s.snapshotId === snapshot.snapshotId
    );

    if (exists) {
      throw new Error(`Snapshot ${snapshot.snapshotId} already exists`);
    }

    this.store.push(snapshot);
  }

  async getById(snapshotId: string): Promise<ReportingSnapshot | null> {
    return this.store.find(s => s.snapshotId === snapshotId) ?? null;
  }

  async getLatest(): Promise<ReportingSnapshot | null> {
    if (this.store.length === 0) {
      return null;
    }
    return this.store[this.store.length - 1];
  }

  async list(): Promise<ReportingSnapshot[]> {
    return [...this.store];
  }
}
