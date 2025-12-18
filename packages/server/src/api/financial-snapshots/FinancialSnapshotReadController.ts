// packages/server/src/api/financial-snapshots/FinancialSnapshotReadController.ts
// FINANCIAL SNAPSHOT READ CONTROLLER
//
// Rules:
// - READ ONLY
// - No snapshot creation
// - No recomputation
// - Immutable data only

import { Request, Response } from 'express';
import { FinancialSnapshotReadRepository } from './FinancialSnapshotReadRepository';

export class FinancialSnapshotReadController {
  constructor(
    private readonly repository: FinancialSnapshotReadRepository
  ) {}

  /**
   * GET /api/finance/snapshots
   */
  async listSnapshots(req: Request, res: Response) {
    const snapshots = await this.repository.listAll();
    res.json(snapshots);
  }

  /**
   * GET /api/finance/snapshots/:snapshotId
   */
  async getSnapshotById(req: Request, res: Response) {
    const { snapshotId } = req.params;

    const snapshot = await this.repository.getById(snapshotId);

    if (!snapshot) {
      return res.status(404).json({
        error: 'SNAPSHOT_NOT_FOUND',
        snapshotId,
      });
    }

    res.json(snapshot);
  }
}
