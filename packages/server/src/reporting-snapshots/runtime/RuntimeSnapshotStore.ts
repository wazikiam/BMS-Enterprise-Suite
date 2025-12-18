// packages/server/src/reporting-snapshots/runtime/RuntimeSnapshotStore.ts

/**
 * RuntimeSnapshotStore is NON-AUTHORITATIVE.
 *
 * It exists only to serve the runtime API for snapshot viewing.
 * It may be cleared on restart without violating governance.
 *
 * Audit authority remains the immutable vault.
 */
export interface RuntimeSnapshotStore {
  put(snapshotId: string, payload: unknown): Promise<void>;
  get(snapshotId: string): Promise<unknown | null>;
  delete(snapshotId: string): Promise<void>;
}
