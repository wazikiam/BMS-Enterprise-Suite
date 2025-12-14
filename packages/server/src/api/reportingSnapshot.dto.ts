// packages/server/src/api/reportingSnapshot.dto.ts

export interface GenerateSnapshotRequest {
  snapshotId: string;
  periodFrom: string; // ISO date
  periodTo: string;   // ISO date
  asOf: string;       // ISO date
}

export interface SnapshotResponse {
  snapshotId: string;
  version: number;
  period: {
    from: string;
    to: string;
  };
  asOf: string;
  generatedAt: string;
  sales: unknown;
  accountsReceivable: unknown;
}
