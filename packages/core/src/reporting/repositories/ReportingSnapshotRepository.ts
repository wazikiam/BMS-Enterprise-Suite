// packages/core/src/reporting/repositories/ReportingSnapshotRepository.ts

import { ReportingSnapshot } from '../dtos/ReportingSnapshot';

/**
 * ReportingSnapshotRepository defines an append-only
 * storage contract for reporting snapshots.
 *
 * Implementations must NEVER mutate or overwrite snapshots.
 */
export interface IReportingSnapshotRepository {
  /**
   * Append a newly generated snapshot.
   * Must fail if snapshotId already exists.
   */
  append(snapshot: ReportingSnapshot): Promise<void>;

  /**
   * Retrieve a snapshot by its stable identifier.
   */
  getById(snapshotId: string): Promise<ReportingSnapshot | null>;

  /**
   * Retrieve the most recent snapshot for a given scope.
   */
  getLatest(params: {
    periodFrom: Date;
    periodTo: Date;
    asOf: Date;
  }): Promise<ReportingSnapshot | null>;

  /**
   * Retrieve historical snapshots in generation order.
   */
  list(params?: {
    fromGeneratedAt?: Date;
    toGeneratedAt?: Date;
    limit?: number;
  }): Promise<ReportingSnapshot[]>;
}
