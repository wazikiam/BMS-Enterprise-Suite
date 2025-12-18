// apps/admin-web/src/ApprovedSnapshotResolver.ts
// Week 36 — Approved Snapshot Resolver (UI-first governance)
//
// This file contains TWO layers:
// 1) Pure resolution logic (backward-compatible storage keys)
// 2) A deterministic, read-only UI resolver component (default export)
//    used by the router route: /reports/snapshots/approved
//
// Rules:
// - READ-ONLY (no mutations)
// - Deterministic behavior
// - Fail-closed: explicit message if no approved snapshot exists

import React from 'react';
import { Navigate } from 'react-router-dom';

export type SnapshotStatus = 'draft' | 'provisional' | 'final' | 'closed';

export type SnapshotMeta = {
  label?: string;
  notes?: string;
  pinned?: boolean;
  status?: SnapshotStatus;

  // These may exist depending on your Week 30–35 implementation
  sealedAt?: string;
  sealedHash?: string;
  verifiedAt?: string;

  // Some builds store approvals here
  approvals?: Array<{
    name: string;
    role?: string;
    at: string;
  }>;
};

// Keys we will *try* to read (backward compatible)
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

/**
 * localStorage can throw in restricted environments.
 * Governance posture: fail-closed by returning null-equivalent storage.
 */
function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function loadMetaMap(): Record<string, SnapshotMeta> {
  return safeParse<Record<string, SnapshotMeta>>(
    safeGetItem(META_KEY),
    {}
  );
}

/**
 * Some implementations store approvals separately.
 * Expected shape:
 * { [snapshotId]: [{ name, role?, at }] }
 */
function loadApprovalsMap(): Record<
  string,
  Array<{ name: string; role?: string; at: string }>
> {
  return safeParse(safeGetItem(APPROVALS_KEY), {});
}

/**
 * Some implementations store seal separately.
 * Expected shape:
 * { [snapshotId]: { sealedAt, sealedHash } }
 */
function loadSealMap(): Record<string, { sealedAt?: string; sealedHash?: string }> {
  return safeParse(safeGetItem(SEAL_KEY), {});
}

/**
 * Some implementations store verification separately.
 * Expected shape:
 * { [snapshotId]: { verifiedAt } }
 */
function loadVerifyMap(): Record<string, { verifiedAt?: string }> {
  return safeParse(safeGetItem(VERIFY_KEY), {});
}

export type ApprovedSnapshotResolution = {
  snapshotId: string;
  label?: string;

  status: SnapshotStatus;
  sealedAt?: string;
  sealedHash?: string;
  verifiedAt?: string;

  approvals: Array<{ name: string; role?: string; at: string }>;
};

export function computeApprovals(
  snapshotId: string,
  meta: SnapshotMeta,
  approvalsMap: Record<string, Array<{ name: string; role?: string; at: string }>>
) {
  const fromMeta = Array.isArray(meta.approvals) ? meta.approvals : [];
  const fromMap = Array.isArray(approvalsMap[snapshotId]) ? approvalsMap[snapshotId] : [];

  // Merge + de-dupe by (name)
  const merged = [...fromMeta, ...fromMap];
  const seen = new Set<string>();
  const uniq: Array<{ name: string; role?: string; at: string }> = [];

  for (const a of merged) {
    const key = (a?.name || '').trim().toLowerCase();
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    uniq.push({ name: a.name, role: a.role, at: a.at });
  }

  return uniq;
}

export function isApprovedSnapshot(res: ApprovedSnapshotResolution): boolean {
  const statusOk = res.status === 'final';
  const sealedOk = !!res.sealedAt && !!res.sealedHash;
  const verifiedOk = !!res.verifiedAt;

  // 4-eyes: 2 distinct approvals
  const approvalsOk = res.approvals.length >= 2;

  return statusOk && sealedOk && verifiedOk && approvalsOk;
}

/**
 * Picks a single approved snapshot to drive the dashboard.
 * Strategy:
 * 1) Prefer pinned approved snapshots
 * 2) Otherwise choose latest by verifiedAt, then sealedAt
 */
export function resolveApprovedSnapshot(): ApprovedSnapshotResolution | null {
  const metaMap = loadMetaMap();
  const approvalsMap = loadApprovalsMap();
  const sealMap = loadSealMap();
  const verifyMap = loadVerifyMap();

  const candidates: ApprovedSnapshotResolution[] = Object.keys(metaMap).map((snapshotId) => {
    const meta = metaMap[snapshotId] || {};
    const status = (meta.status ?? 'draft') as SnapshotStatus;

    const seal = sealMap[snapshotId] || {};
    const verify = verifyMap[snapshotId] || {};

    const sealedAt = meta.sealedAt ?? seal.sealedAt;
    const sealedHash = meta.sealedHash ?? seal.sealedHash;
    const verifiedAt = meta.verifiedAt ?? verify.verifiedAt;

    const approvals = computeApprovals(snapshotId, meta, approvalsMap);

    return {
      snapshotId,
      label: meta.label,
      status,
      sealedAt,
      sealedHash,
      verifiedAt,
      approvals,
    };
  });

  const approved = candidates.filter(isApprovedSnapshot);
  if (approved.length === 0) return null;

  // Prefer pinned approved snapshots
  const pinnedApproved = approved.filter((a) => !!metaMap[a.snapshotId]?.pinned);
  const pool = pinnedApproved.length ? pinnedApproved : approved;

  pool.sort((x, y) => {
    const vx = x.verifiedAt ? new Date(x.verifiedAt).getTime() : 0;
    const vy = y.verifiedAt ? new Date(y.verifiedAt).getTime() : 0;
    if (vy !== vx) return vy - vx;

    const sx = x.sealedAt ? new Date(x.sealedAt).getTime() : 0;
    const sy = y.sealedAt ? new Date(y.sealedAt).getTime() : 0;
    return sy - sx;
  });

  return pool[0];
}

/**
 * DEFAULT EXPORT — Router expects a component here.
 * Deterministic behavior:
 * - If an approved snapshot exists: redirect to its details route.
 * - Otherwise: render a fail-closed message with a safe navigation link.
 */
export default function ApprovedSnapshotResolver(): React.ReactElement {
  const resolved = resolveApprovedSnapshot();

  if (resolved?.snapshotId) {
    return React.createElement(Navigate, {
      to: `/reports/snapshots/${resolved.snapshotId}`,
      replace: true,
    });
  }

  // Fail-closed: explicit message, no guessing, no regeneration.
  return React.createElement(
    'div',
    { style: { padding: 24 } },
    React.createElement('h1', { style: { margin: 0 } }, 'Approved Snapshot'),
    React.createElement(
      'p',
      { style: { marginTop: 8, opacity: 0.8 } },
      'No approved snapshot available.'
    ),
    React.createElement(
      'p',
      { style: { marginTop: 12, opacity: 0.7 } },
      'This resolver is read-only. To view snapshots, go to ',
      React.createElement('a', { href: '/reports/snapshots' }, '/reports/snapshots'),
      '.'
    )
  );
}
