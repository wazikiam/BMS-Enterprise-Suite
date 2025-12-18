// packages/server/src/api/internal/snapshotVaultDeletion.controller.ts

import { Request, Response } from 'express';
import { SnapshotVaultDeletionService } from '../../reporting/vault/SnapshotVaultDeletionService';

/**
 * Internal, operator-only controller for snapshot vault deletion workflow.
 * No business logic is allowed here.
 */
export class SnapshotVaultDeletionController {
  constructor(
    private readonly deletionService: SnapshotVaultDeletionService
  ) {}

  /**
   * POST /internal/snapshots/:snapshotId/legal-hold
   */
  placeLegalHold = async (req: Request, res: Response) => {
    const actor = (req as any).actor;

    if (!actor || !actor.actorId) {
      return res.status(403).json({ error: 'Actor context required' });
    }

    try {
      await this.deletionService.placeLegalHold({
        snapshotId: req.params.snapshotId,
        actorId: actor.actorId,
        reason: req.body?.reason,
      });

      return res.status(201).json({ legalHoldPlaced: true });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  };

  /**
   * POST /internal/snapshots/:snapshotId/delete-request
   */
  requestDeletion = async (req: Request, res: Response) => {
    const actor = (req as any).actor;

    if (!actor || !actor.actorId) {
      return res.status(403).json({ error: 'Actor context required' });
    }

    try {
      const result = await this.deletionService.requestDeletion({
        snapshotId: req.params.snapshotId,
        actorId: actor.actorId,
        reason: req.body?.reason,
      });

      return res.status(201).json(result);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  };

  /**
   * POST /internal/delete-request/:requestId/approve
   */
  approveDeletion = async (req: Request, res: Response) => {
    const actor = (req as any).actor;

    if (!actor || !actor.actorId) {
      return res.status(403).json({ error: 'Actor context required' });
    }

    try {
      await this.deletionService.approveDeletion({
        requestId: req.params.requestId,
        actorId: actor.actorId,
      });

      return res.status(200).json({ approved: true });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  };

  /**
   * POST /internal/delete-request/:requestId/execute
   */
  executeDeletion = async (req: Request, res: Response) => {
    const actor = (req as any).actor;

    if (!actor || !actor.actorId) {
      return res.status(403).json({ error: 'Actor context required' });
    }

    try {
      await this.deletionService.executeDeletion({
        requestId: req.params.requestId,
        actorId: actor.actorId,
      });

      return res.status(200).json({ executed: true });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  };
}
