// packages/server/src/api/reporting-snapshots/vaultStatus.controller.ts

import { Request, Response } from 'express';

import { ReportingSnapshotVault } from '@bms/core/src/reporting-snapshots/vault/ReportingSnapshotVault';
import { RuntimeSnapshotStore } from '../../reporting-snapshots/runtime/RuntimeSnapshotStore';

/**
 * VaultStatusController
 *
 * Read-only operational status endpoint.
 *
 * Returns presence + metadata only:
 * - vault bundle existence for sealedHash
 * - runtime payload existence for snapshotId
 *
 * SECURITY:
 * - No payload returned
 * - Requires an ops/audit role
 */
export class VaultStatusController {
  constructor(
    private readonly vault: ReportingSnapshotVault,
    private readonly runtimeStore: RuntimeSnapshotStore
  ) {}

  async getStatus(req: Request, res: Response): Promise<void> {
    const sealedHash = typeof req.query.sealedHash === 'string' ? req.query.sealedHash : undefined;
    const snapshotId = typeof req.query.snapshotId === 'string' ? req.query.snapshotId : undefined;

    if (!sealedHash && !snapshotId) {
      res.status(400).json({ error: 'sealedHash or snapshotId is required' });
      return;
    }

    const actor = (req as any).actor;
    if (!actor || !Array.isArray(actor.roles)) {
      res.status(403).json({ error: 'status not authorized' });
      return;
    }

    const roles: string[] = actor.roles;
    const allowed =
      roles.includes('SNAPSHOT_VAULT_AUDITOR') ||
      roles.includes('SNAPSHOT_VAULT_RESTORER') ||
      roles.includes('SNAPSHOT_VAULT_WRITER');

    if (!allowed) {
      res.status(403).json({ error: 'ops/audit role required' });
      return;
    }

    const vaultBundle = sealedHash ? await this.vault.getSealedBundle(sealedHash) : null;

    const runtimePayload =
      snapshotId ? await this.runtimeStore.get(snapshotId) : null;

    res.status(200).json({
      sealedHash: sealedHash ?? vaultBundle?.sealedHash ?? null,
      snapshotId: snapshotId ?? vaultBundle?.snapshotId ?? null,

      vault: {
        present: Boolean(vaultBundle),
        meta: vaultBundle
          ? {
              kind: vaultBundle.kind,
              version: vaultBundle.version,
              period: vaultBundle.period,
              asOf: vaultBundle.asOf,
              sealedAt: vaultBundle.sealedAt,
            }
          : null,
      },

      runtime: {
        present: Boolean(runtimePayload),
      },
    });
  }
}
