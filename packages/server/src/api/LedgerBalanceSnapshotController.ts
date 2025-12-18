// packages/server/src/api/LedgerBalanceSnapshotController.ts

import { Request, Response } from 'express';
import { LedgerBalanceSnapshotService } from './LedgerBalanceSnapshotService';

/**
 * READ-ONLY HTTP controller.
 *
 * Responsibilities:
 * - Accept snapshotId
 * - Delegate to snapshot orchestration service
 * - Return deterministic balance view
 *
 * No mutations.
 * No business logic.
 */
export class LedgerBalanceSnapshotController {
  constructor(
    private readonly snapshotService: LedgerBalanceSnapshotService
  ) {}

  async getBalanceAsOfSnapshot(req: Request, res: Response): Promise<void> {
    const { snapshotId } = req.params;

    if (!snapshotId) {
      res.status(400).json({ error: 'snapshotId is required' });
      return;
    }

    const balance =
      await this.snapshotService.getBalanceAsOfSnapshot(snapshotId);

    res.status(200).json(balance);
  }
}
