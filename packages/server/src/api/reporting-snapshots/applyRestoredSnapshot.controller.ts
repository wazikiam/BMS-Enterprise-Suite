// packages/server/src/api/reporting-snapshots/applyRestoredSnapshot.controller.ts

import { Request, Response } from 'express';

import {
  ReportingSnapshotVault,
  ReportingSnapshotVaultRestoreEventV1,
} from '@bms/core/src/reporting-snapshots/vault/ReportingSnapshotVault';

import { RuntimeSnapshotStore } from '../../reporting-snapshots/runtime/RuntimeSnapshotStore';

/**
 * ApplyRestoredSnapshotController
 *
 * Explicitly applies a restored snapshot payload into the
 * NON-AUTHORITATIVE runtime snapshot store.
 *
 * Restore ≠ Apply.
 * This endpoint represents activation intent and execution.
 */
export class ApplyRestoredSnapshotController {
  constructor(
    private readonly vault: ReportingSnapshotVault,
    private readonly runtimeStore: RuntimeSnapshotStore,
    private readonly runtimeTarget: string
  ) {}

  async apply(req: Request, res: Response): Promise<void> {
    const { sealedHash, reason } = req.body ?? {};

    if (!sealedHash || typeof sealedHash !== 'string') {
      res.status(400).json({ error: 'sealedHash is required' });
      return;
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
      res.status(400).json({ error: 'reason is required (min 5 chars)' });
      return;
    }

    /**
     * Actor identity must be injected by auth middleware.
     */
    const actor = (req as any).actor;
    if (!actor || !Array.isArray(actor.roles)) {
      res.status(403).json({ error: 'apply not authorized' });
      return;
    }

    if (!actor.roles.includes('SNAPSHOT_VAULT_RESTORER')) {
      res.status(403).json({ error: 'apply role required' });
      return;
    }

    const bundle = await this.vault.getSealedBundle(sealedHash);
    if (!bundle) {
      res.status(404).json({ error: 'sealed snapshot not found in vault' });
      return;
    }

    /**
     * Apply payload to NON-AUTHORITATIVE runtime store
     */
    await this.runtimeStore.put(bundle.snapshotId, bundle.payload);

    /**
     * Emit APPLY event (append-only, audit-correct)
     */
    const applyEvent: ReportingSnapshotVaultRestoreEventV1 = {
      kind: 'SNAPSHOT_VAULT_RESTORE_EVENT_V1',
      action: 'APPLY',
      at: new Date().toISOString(),
      snapshotId: bundle.snapshotId,
      sealedHash: bundle.sealedHash,
      actor: {
        id: actor.id,
        displayName: actor.displayName,
        roles: actor.roles,
      },
      reason,
      target: this.runtimeTarget,
    };

    await this.vault.appendRestoreEvent(applyEvent);

    res.status(202).json({
      status: 'APPLIED_TO_RUNTIME',
      snapshotId: bundle.snapshotId,
      sealedHash: bundle.sealedHash,
    });
  }
}
