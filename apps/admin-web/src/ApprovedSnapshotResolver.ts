// apps/admin-web/src/ApprovedSnapshotResolver.ts
// Week 36 — Approved Snapshot Resolver (UI-first governance)
//
// Behavior (CORRECTED):
// - If NO approved snapshot → fail-closed lock screen
// - If approved snapshot exists → render child routes (Outlet)
// - No forced redirect
//
// This allows snapshot-governed pages (AR, TB, Ledger) to render
// while preserving snapshot-first discipline.

import React from 'react';
import { Outlet } from 'react-router-dom';

export type SnapshotStatus = 'draft' | 'provisional' | 'final' | 'closed';

export type SnapshotMeta = {
  label?: string;
  notes?: string;
  pinned?: boolean;
  status?: SnapshotStatus;

  sealedAt?: string;
  sealedHash?: string;
  verifiedAt?: string;

  approvals?: Array<{
    name: string;
    role?: string;
    at: string;
  }>;
};

const META_KEY = 'bms.snapshot.meta';
const APPROVALS_KEY = 'bms.snapshot.approvals';
const SEAL_KEY = 'bms.snapshot.seal';
const VERIFY_KEY = 'bms.snapshot.verify';

function safeParse<T>(raw: string | null, fallback: T): T {
  try {
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function loadMetaMap(): Record<string, SnapshotMeta> {
  return safeParse(safeGetItem(META_KEY), {});
}

function loadApprovalsMap(): Record<
  string,
  Array<{ name: string; role?: string; at: string }>
> {
  return safeParse(safeGetItem(APPROVALS_KEY), {});
}

function loadSealMap(): Record<string, { sealedAt?: string; sealedHash?: string }> {
  return safeParse(safeGetItem(SEAL_KEY), {});
}

function loadVerifyMap(): Record<string, { verifiedAt?: string }> {
  return safeParse(safeGetItem(VERIFY_KEY), {});
}

type ApprovedSnapshotResolution = {
  snapshotId: string;
  status: SnapshotStatus;
  sealedAt?: string;
  sealedHash?: string;
  verifiedAt?: string;
  approvals: Array<{ name: string; role?: string; at: string }>;
};

function isApprovedSnapshot(res: ApprovedSnapshotResolution): boolean {
  return (
    res.status === 'final' &&
    !!res.sealedAt &&
    !!res.sealedHash &&
    !!res.verifiedAt &&
    res.approvals.length >= 2
  );
}

function resolveApprovedSnapshot(): ApprovedSnapshotResolution | null {
  const metaMap = loadMetaMap();
  const approvalsMap = loadApprovalsMap();
  const sealMap = loadSealMap();
  const verifyMap = loadVerifyMap();

  for (const snapshotId of Object.keys(metaMap)) {
    const meta = metaMap[snapshotId] || {};
    const approvals = approvalsMap[snapshotId] || [];
    const seal = sealMap[snapshotId] || {};
    const verify = verifyMap[snapshotId] || {};

    const res: ApprovedSnapshotResolution = {
      snapshotId,
      status: (meta.status ?? 'draft') as SnapshotStatus,
      sealedAt: meta.sealedAt ?? seal.sealedAt,
      sealedHash: meta.sealedHash ?? seal.sealedHash,
      verifiedAt: meta.verifiedAt ?? verify.verifiedAt,
      approvals,
    };

    if (isApprovedSnapshot(res)) {
      return res;
    }
  }

  return null;
}

export default function ApprovedSnapshotResolver(): React.ReactElement {
  const approved = resolveApprovedSnapshot();

  if (!approved) {
    return (
      <div style={{ padding: 24 }}>
        <h1>Approved Snapshot</h1>
        <p>No approved snapshot available.</p>
        <p style={{ opacity: 0.7 }}>
          This system is snapshot-governed and read-only.
        </p>
      </div>
    );
  }

  // APPROVED → allow governed pages to render
  return <Outlet />;
}
