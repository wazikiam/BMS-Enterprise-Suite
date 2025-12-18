// packages/server/src/api/internal/snapshotVault.routes.ts

import { Router } from 'express';
import { SnapshotVaultController } from './snapshotVault.controller';

/**
 * Internal-only routes.
 * Must be mounted behind operator authorization.
 */
export function createSnapshotVaultRouter(
  controller: SnapshotVaultController
): Router {
  const router = Router();

  router.post(
    '/snapshots/:snapshotId/vault',
    controller.exportToVault
  );

  router.post(
    '/snapshots/:snapshotId/restore',
    controller.restoreFromVault
  );

  return router;
}
