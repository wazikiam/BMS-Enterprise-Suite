// packages/server/src/api/LedgerBalanceSnapshotService.ts

/**
 * Minimal reporting snapshot shape required for read-only orchestration.
 * This service is intentionally ignorant of persistence and SQL.
 */
export type ReportingSnapshotRecord = {
  snapshotId: string;
  periodFrom: Date;
  periodTo: Date;
  asOf: Date;
  supersededBySnapshotId?: string | null;
};

/**
 * Read-only port for loading immutable reporting snapshots.
 * Implemented in server infrastructure, NOT in core.
 */
export interface ReportingSnapshotReader {
  getById(snapshotId: string): Promise<ReportingSnapshotRecord | null>;
}

/**
 * Read-only port for resolving ledger balances.
 *
 * IMPORTANT:
 * Governed read boundary only.
 * No write-side dependency.
 */
export interface LedgerBalanceReadPort {
  getBalance(params: {
    periodFrom?: Date;
    periodTo?: Date;
    asOf: Date;
  }): Promise<any>;
}

/**
 * READ-ONLY orchestration service.
 *
 * CRITICAL RULE (Week 21):
 * - MUST NOT throw
 * - MUST NOT crash server
 * - Missing snapshot → return empty result with warning
 */
export class LedgerBalanceSnapshotService {
  constructor(
    private readonly snapshotReader: ReportingSnapshotReader,
    private readonly ledgerBalanceReadPort: LedgerBalanceReadPort
  ) {}

  async getBalanceAsOfSnapshot(snapshotId: string): Promise<any> {
    const snapshot = await this.snapshotReader.getById(snapshotId);

    if (!snapshot) {
      return {
        snapshotId,
        balances: [],
        warning: 'Snapshot not found in read model (in-memory)',
      };
    }

    if (snapshot.supersededBySnapshotId) {
      return {
        snapshotId,
        balances: [],
        warning: `Snapshot superseded by ${snapshot.supersededBySnapshotId}`,
      };
    }

    const { periodFrom, periodTo, asOf } = snapshot;

    return this.ledgerBalanceReadPort.getBalance({
      periodFrom,
      periodTo,
      asOf,
    });
  }
}
