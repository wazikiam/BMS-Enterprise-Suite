// packages/server/src/services/snapshotSupersessionResolver.ts

export type SnapshotClassification =
  | 'PERIOD_CLOSE'
  | 'MANAGEMENT_REVIEW'
  | 'AUDIT_COMPLIANCE'
  | 'INVESTIGATION';

export interface ApprovedSnapshotDescriptor {
  snapshotId: string;
  classification: SnapshotClassification;
  period: string;
  approvedAt: string; // ISO timestamp
}

/**
 * SnapshotSupersessionResolver
 *
 * Resolves which snapshot is considered "latest" for a given
 * classification + period combination.
 *
 * IMPORTANT:
 * - Supersession does NOT delete or invalidate older snapshots
 * - It only defines resolution order
 */
export class SnapshotSupersessionResolver {
  static resolveLatest(
    snapshots: ApprovedSnapshotDescriptor[],
    classification: SnapshotClassification,
    period: string
  ): ApprovedSnapshotDescriptor | null {
    const candidates = snapshots.filter(
      (s) =>
        s.classification === classification &&
        s.period === period
    );

    if (candidates.length === 0) {
      return null;
    }

    // Deterministic ordering: newest approval wins
    candidates.sort((a, b) => {
      const aTime = Date.parse(a.approvedAt);
      const bTime = Date.parse(b.approvedAt);
      return bTime - aTime;
    });

    return candidates[0];
  }
}
