// packages/server/src/reporting/runtime/runtimeSnapshotStore.ts

/**
 * Volatile, in-memory runtime snapshot store.
 * Cleared on process restart BY DESIGN.
 */

const store = new Map<string, unknown>();

export const runtimeSnapshotStore = {
  async getPayload(snapshotId: string): Promise<unknown | null> {
    return store.get(snapshotId) ?? null;
  },

  async setPayload(snapshotId: string, payload: unknown): Promise<void> {
    store.set(snapshotId, payload);
  },

  async hasPayload(snapshotId: string): Promise<boolean> {
    return store.has(snapshotId);
  },

  async clear(): Promise<void> {
    store.clear();
  },
};
