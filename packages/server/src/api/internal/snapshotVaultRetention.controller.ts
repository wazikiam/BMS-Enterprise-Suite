// packages/server/src/api/internal/snapshotVaultRetention.controller.ts

import { Request, Response } from 'express';
import { SnapshotVaultRetentionService } from '../../reporting/vault/SnapshotVaultRetentionService';

/**
 * Internal, operator-only retention policy controller.
 */
export class SnapshotVaultRetentionController {
  constructor(
    private readonly retentionService: SnapshotVaultRetentionService
  ) {}

  /**
   * POST /internal/retention
   */
  setPolicy = async (req: Request, res: Response) => {
    const actor = (req as any).actor;
    if (!actor || !actor.actorId) {
      return res.status(403).json({ error: 'Actor context required' });
    }

    try {
      const result = await this.retentionService.setPolicy({
        name: req.body?.name,
        retentionMode: req.body?.retentionMode,
        ageDays: req.body?.ageDays,
        actorId: actor.actorId,
        note: req.body?.note,
      });

      return res.status(201).json(result);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  };

  /**
   * GET /internal/retention/:name
   */
  getLatestPolicy = async (req: Request, res: Response) => {
    try {
      const policy = await this.retentionService.getLatestPolicy(
        req.params.name
      );
      return res.status(200).json({ policy });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  };

  /**
   * GET /internal/retention/:name/dry-run
   */
  dryRun = async (req: Request, res: Response) => {
    try {
      const results =
        await this.retentionService.dryRunEligibleVaultEntries({
          policyName: req.params.name,
          now: new Date(),
        });

      return res.status(200).json({ eligible: results });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  };
}
