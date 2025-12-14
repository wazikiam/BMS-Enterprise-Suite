// packages/server/src/api/LedgerBalanceSnapshotService.ts

import { LedgerBalanceQuery } from '@bms/core/src/ledger-balances/LedgerBalanceQuery';
import { ReportingSnapshotRepository } from './ReportingSnapshotRepository';

/**
 * READ-ONLY orchestration service.
 *
 * Responsibilities:
 * - Load immutable Reporting Snapshot
 * - Validate snapshot is resolvable and not superseded
 * - Extract (periodFrom, periodTo, asOf)
 * - Delegate balance resolution to LedgerBalanceQuery
 *
 * Constraints enforced:
 * - No SQL
 * - No writes
 * - No mutations
 * - No balance math
 * - Pure composition only
 */
export class LedgerBalanceSnapshotService {
  constructor(
    private readonly snapshotRepository: ReportingSnapshotRepository,
    private readonly ledgerBalanceQuery: LedgerBalanceQuery
  ) {}

  async getBalanceAsOfSnapshot(snapshotId: string) {
    const snapshot = await this.snapshotRepository.getById(snapshotId);

    if (!snapshot) {
      throw new Error(`Reporting snapshot not found: ${snapshotId}`);
    }

    if (snapshot.supersededBySnapshotId) {
      throw new Error(
        `Reporting snapshot ${snapshotId} has been superseded by ${snapshot.supersededBySnapshotId}`
      );
    }

    const { periodFrom, periodTo, asOf } = snapshot;

    return this.ledgerBalanceQuery.getBalance({
      periodFrom,
      periodTo,
      asOf,
    });
  }
}
