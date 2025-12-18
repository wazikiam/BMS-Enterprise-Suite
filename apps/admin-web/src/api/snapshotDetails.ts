// apps/admin-web/src/api/snapshotDetails.ts
// Read-only Snapshot Details API client (TYPE-SAFE, GOVERNANCE-GRADE)
// Phase: Admin Snapshot UX hardening
//
// Rules:
// - READ-ONLY
// - No mutations
// - No backend changes
// - Fail-closed semantics preserved

/**
 * A single line of a trial balance snapshot.
 * This reflects what is already rendered in the UI.
 */
export type TrialBalanceLine = {
  account: string;
  debit: number;
  credit: number;
  balance: number;
};

/**
 * Reporting snapshot details contract.
 * This is intentionally minimal and audit-focused.
 *
 * NOTE:
 * - Fields are optional where historical or in-memory snapshots
 *   may not include them.
 * - No inferred or computed fields are introduced here.
 */
export type ReportingSnapshotDetails = {
  snapshotId: string;

  period?: {
    from: string;
    to: string;
  };

  asOf: string;

  generatedAt?: string;

  currency?: string;

  trialBalance?: TrialBalanceLine[];
};

const API_BASE = 'http://localhost:3001/api/reports';

/**
 * Strict fetch (legacy):
 * - Throws on any non-2xx response
 */
export async function fetchSnapshotDetails(
  snapshotId: string
): Promise<ReportingSnapshotDetails> {
  const res = await fetch(`${API_BASE}/snapshots/${snapshotId}`);

  if (!res.ok) {
    throw new Error(`Failed to load snapshot (${res.status})`);
  }

  return res.json();
}

/**
 * Safe fetch (Week 36):
 * - Returns null on 404 (e.g. in-memory snapshot cleared)
 * - Throws for all other non-2xx responses
 */
export async function fetchSnapshotDetailsOptional(
  snapshotId: string
): Promise<ReportingSnapshotDetails | null> {
  const res = await fetch(`${API_BASE}/snapshots/${snapshotId}`);

  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Failed to load snapshot (${res.status})`);
  }

  return res.json();
}
