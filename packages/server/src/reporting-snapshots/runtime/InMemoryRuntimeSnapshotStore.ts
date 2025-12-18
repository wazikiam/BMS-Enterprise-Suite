// packages/server/src/reporting-snapshots/runtime/InMemoryRuntimeSnapshotStore.ts

import { RuntimeSnapshotStore } from './RuntimeSnapshotStore';

export class InMemoryRuntimeSnapshotStore implements RuntimeSnapshotStore {
  private readonly map = new Map<string, unknown>();

  async put(snapshotId: string, payload: unknown): Promise<void> {
    this.map.set(snapshotId, payload);
  }

  async get(snapshotId: string): Promise<unknown | null> {
    return this.map.has(snapshotId) ? this.map.get(snapshotId)! : null;
  }

  async delete(snapshotId: string): Promise<void> {
    this.map.delete(snapshotId);
  }
}
