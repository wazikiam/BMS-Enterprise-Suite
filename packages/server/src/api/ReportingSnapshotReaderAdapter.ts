// packages/server/src/api/ReportingSnapshotReaderAdapter.ts

import {
  ReportingSnapshotReader,
  ReportingSnapshotRecord,
} from './LedgerBalanceSnapshotService';
import { sharedReportingSnapshotRepository } from './sharedReportingSnapshotStore';

/**
 * ReportingSnapshotReaderAdapter
 *
 * SINGLE authoritative adapter over the shared in-memory
 * reporting snapshot repository.
 *
 * Purpose:
 * - Guarantee that ALL consumers (reporting + ledger snapshot)
 *   read from the exact same snapshot instance.
 *
 * Characteristics:
 * - Read-only
 * - No writes
 * - No side effects
 * - No caching
 */
export const reportingSnapshotReaderAdapter: ReportingSnapshotReader = {
  async getById(snapshotId: string): Promise<ReportingSnapshotRecord | null> {
    const snapshot = await sharedReportingSnapshotRepository.getById(snapshotId);
    if (!snapshot) return null;

    return {
      snapshotId: snapshot.snapshotId,
      periodFrom: snapshot.period.from,
      periodTo: snapshot.period.to,
      asOf: snapshot.asOf,
      supersededBySnapshotId: null,
    };
  },
};
