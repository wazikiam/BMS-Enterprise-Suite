// packages/server/src/api/sharedReportingSnapshotStore.ts

import { ReportingSnapshot } from '@bms/core/src/reporting/dtos/ReportingSnapshot';
import { IReportingSnapshotRepository } from '@bms/core/src/reporting/repositories/ReportingSnapshotRepository';

/**
 * SHARED IN-MEMORY SNAPSHOT STORE (Week 21)
 *
 * SINGLE SOURCE OF TRUTH for:
 * - snapshot generation
 * - snapshot listing
 * - snapshot lookup
 *
 * This eliminates the “snapshot exists but not found” bug.
 */
class SharedReportingSnapshotRepository
  implements IReportingSnapshotRepository
{
  private readonly store: ReportingSnapshot[] = [];

  async append(snapshot: ReportingSnapshot): Promise<void> {
    this.store.push(snapshot);
  }

  async getById(snapshotId: string): Promise<ReportingSnapshot | null> {
    return this.store.find(s => s.snapshotId === snapshotId) ?? null;
  }

  async getLatest(): Promise<ReportingSnapshot | null> {
    return this.store.at(-1) ?? null;
  }

  async list(): Promise<ReportingSnapshot[]> {
    return [...this.store];
  }
}

/**
 * Export ONE shared instance.
 * Imported everywhere snapshots are needed.
 */
export const sharedReportingSnapshotRepository =
  new SharedReportingSnapshotRepository();
