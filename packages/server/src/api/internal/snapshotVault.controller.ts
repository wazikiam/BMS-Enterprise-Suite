// packages/server/src/api/internal/snapshotVault.controller.ts

import { Request, Response } from 'express';
import { ReportingSnapshotVaultService } from '../../reporting/vault/ReportingSnapshotVaultService';
import { ReportingSnapshotRestoreService } from '../../reporting/vault/ReportingSnapshotRestoreService';

/**
 * Internal-only controller.
 * Actor context is injected by actorInjectionMiddleware.
 * NEVER expose publicly.
 */
export class SnapshotVaultController {
  constructor(
    private readonly vaultService: ReportingSnapshotVaultService,
    private readonly restoreService: ReportingSnapshotRestoreService
  ) {}

  /**
   * POST /internal/snapshots/:snapshotId/vault
   */
  exportToVault = async (req: Request, res: Response) => {
    const { snapshotId } = req.params;
    const actor = (req as any).actor;

    if (!actor || !actor.actorId) {
      return res.status(403).json({ error: 'Actor context required' });
    }

    try {
      const result = await this.vaultService.exportToVault({
        snapshotId,
        actorId: actor.actorId,
        note: req.body?.note,
      });

      return res.status(201).json(result);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  };

  /**
   * POST /internal/snapshots/:snapshotId/restore
   */
  restoreFromVault = async (req: Request, res: Response) => {
    const { snapshotId } = req.params;
    const actor = (req as any).actor;

    if (!actor || !actor.actorId) {
      return res.status(403).json({ error: 'Actor context required' });
    }

    try {
      const result = await this.restoreService.restoreFromVault({
        snapshotId,
        actorId: actor.actorId,
        expectedPayloadHash: req.body?.expectedPayloadHash,
      });

      return res.status(200).json(result);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  };
}
