// apps/admin-web/src/api/snapshots.ts
// Read-only Snapshot API client (Week 21)
// Governance-safe: actor headers enforced

export type ReportingSnapshot = {
  snapshotId: string;
  periodFrom: string;
  periodTo: string;
  asOf: string;
  generatedAt?: string;
};

const API_BASE = 'http://localhost:3001/api/reports';

export async function fetchSnapshots(): Promise<ReportingSnapshot[]> {
  const res = await fetch(`${API_BASE}/snapshots`, {
    headers: {
      'X-Actor-Id': 'admin',
      'X-Actor-Roles': 'ADMIN',
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to load snapshots (${res.status})`);
  }

  return res.json();
}
