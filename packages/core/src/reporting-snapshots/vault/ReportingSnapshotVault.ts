// packages/core/src/reporting-snapshots/vault/ReportingSnapshotVault.ts

export type SnapshotId = string;

/**
 * sealedHash is the cryptographic hash produced by your sealing step.
 * It is the immutable content address for the audit bundle.
 */
export type SealedHash = string;

export type VaultBundleKind = 'SEALED_SNAPSHOT_BUNDLE_V1';

export interface ReportingSnapshotVaultBundleV1 {
  kind: VaultBundleKind;
  snapshotId: SnapshotId;
  version: number;

  period: {
    from: string; // ISO
    to: string; // ISO
  };

  asOf: string; // ISO
  sealedAt: string; // ISO
  sealedHash: SealedHash;

  /**
   * The runtime payload exactly as used to render snapshot reports.
   * This is the audit-grade payload; do not mutate.
   */
  payload: unknown;

  /**
   * Optional metadata for future extensibility (export watermark inputs, etc).
   * Must not include governance decisions that are UI-only today.
   */
  meta?: Record<string, unknown>;
}

export type SnapshotVaultEventAction = 'RESTORE' | 'APPLY';

export interface ReportingSnapshotVaultRestoreEventV1 {
  kind: 'SNAPSHOT_VAULT_RESTORE_EVENT_V1';

  /**
   * Distinguishes intent in the audit log.
   * - RESTORE: vault fetch requested (no activation implied)
   * - APPLY: runtime activation requested/performed
   */
  action: SnapshotVaultEventAction;

  at: string; // ISO
  snapshotId: SnapshotId;
  sealedHash: SealedHash;

  actor: {
    id: string;
    displayName?: string;
    roles: string[];
  };

  /**
   * Free-text justification required by policy.
   * Governance-critical. Must be provided by caller.
   */
  reason: string;

  /**
   * Target runtime store identifier (e.g., "in-memory", "postgres", "redis").
   * For audit traceability only.
   */
  target: string;
}

export interface ReportingSnapshotVault {
  /**
   * Store an immutable sealed snapshot bundle in the vault.
   * MUST be write-once per sealedHash. If already present, content must match exactly.
   */
  storeSealedBundle(bundle: ReportingSnapshotVaultBundleV1): Promise<void>;

  /**
   * Get a sealed snapshot bundle by its sealedHash.
   * Returns null if not found.
   */
  getSealedBundle(sealedHash: SealedHash): Promise<ReportingSnapshotVaultBundleV1 | null>;

  /**
   * Append an immutable vault event to the event log.
   * (Currently used for RESTORE and APPLY events.)
   */
  appendRestoreEvent(event: ReportingSnapshotVaultRestoreEventV1): Promise<void>;
}
