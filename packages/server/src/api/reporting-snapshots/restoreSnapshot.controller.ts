// packages/server/src/api/reporting-snapshots/restoreSnapshot.controller.ts

import { Request, Response } from 'express';

import {
  ReportingSnapshotVault,
  ReportingSnapshotVaultRestoreEventV1,
} from '@bms/core/src/reporting-snapshots/vault/ReportingSnapshotVault';

/**
 * NOTE:
 * This controller does NOT apply payload into runtime.
 * It only fetches + logs the restore intent.
 */
export class RestoreReportingSnapshotController {
  constructor(
    private readonly vault: ReportingSnapshotVault,
    private readonly runtimeTarget: string
  ) {}

  async restore(req: Request, res: Response): Promise<void> {
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
     * Actor identity MUST be injected by auth middleware.
     */
    const actor = (req as any).actor;
    if (!actor || !Array.isArray(actor.roles)) {
      res.status(403).json({ error: 'restore not authorized' });
      return;
    }

    const hasRestoreRole = actor.roles.includes('SNAPSHOT_VAULT_RESTORER');
    if (!hasRestoreRole) {
      res.status(403).json({ error: 'restore role required' });
      return;
    }

    const bundle = await this.vault.getSealedBundle(sealedHash);
    if (!bundle) {
      res.status(404).json({ error: 'sealed snapshot not found in vault' });
      return;
    }

    const restoreEvent: ReportingSnapshotVaultRestoreEventV1 = {
      kind: 'SNAPSHOT_VAULT_RESTORE_EVENT_V1',
      action: 'RESTORE',
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

    await this.vault.appendRestoreEvent(restoreEvent);

    res.status(202).json({
      status: 'RESTORE_ACCEPTED',
      snapshotId: bundle.snapshotId,
      sealedHash: bundle.sealedHash,
      target: this.runtimeTarget,
    });
  }
}
