// packages/server/src/api/internal/snapshotVaultAudit.routes.ts

import { Router } from 'express';
import { SnapshotVaultAuditController } from './snapshotVaultAudit.controller';

export function createSnapshotVaultAuditRouter(
  controller: SnapshotVaultAuditController
): Router {
  const router = Router();

  router.get(
    '/snapshots/:snapshotId/audit',
    controller.listBySnapshot
  );

  return router;
}
