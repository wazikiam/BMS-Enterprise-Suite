// packages/server/src/api/internal/snapshotVaultAudit.controller.ts

import { Request, Response } from 'express';
import { SnapshotVaultAuditReadService } from '../../reporting/vault/SnapshotVaultAuditReadService';

/**
 * Internal-only, operator-only audit read controller.
 */
export class SnapshotVaultAuditController {
  constructor(
    private readonly auditReadService: SnapshotVaultAuditReadService
  ) {}

  /**
   * GET /internal/snapshots/:snapshotId/audit
   */
  listBySnapshot = async (req: Request, res: Response) => {
    const actor = (req as any).actor;
    const { snapshotId } = req.params;

    if (!actor || !actor.actorId) {
      return res.status(403).json({ error: 'Actor context required' });
    }

    const limit = Number(req.query.limit ?? 50);
    const offset = Number(req.query.offset ?? 0);

    try {
      const records = await this.auditReadService.listBySnapshot({
        snapshotId,
        limit,
        offset,
      });

      return res.status(200).json({ records });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  };
}
