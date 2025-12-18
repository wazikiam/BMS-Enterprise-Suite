// apps/admin-web/src/api/snapshotDetails.ts
// Read-only Snapshot Details API client (hardened for Week 36)

export type ReportingSnapshotDetails = any;

const API_BASE = 'http://localhost:3001/api/reports';

/**
 * Strict fetch (legacy): throws on any non-2xx.
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
 * Safe fetch (Week 36): returns null on 404 (in-memory cleared),
 * throws for other errors.
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
