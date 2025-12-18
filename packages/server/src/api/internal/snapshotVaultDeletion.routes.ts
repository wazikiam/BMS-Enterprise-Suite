// packages/server/src/api/internal/snapshotVaultDeletion.routes.ts

import { Router } from 'express';
import { SnapshotVaultDeletionController } from './snapshotVaultDeletion.controller';

export function createSnapshotVaultDeletionRouter(
  controller: SnapshotVaultDeletionController
): Router {
  const router = Router();

  router.post(
    '/snapshots/:snapshotId/legal-hold',
    controller.placeLegalHold
  );

  router.post(
    '/snapshots/:snapshotId/delete-request',
    controller.requestDeletion
  );

  router.post(
    '/delete-request/:requestId/approve',
    controller.approveDeletion
  );

  router.post(
    '/delete-request/:requestId/execute',
    controller.executeDeletion
  );

  return router;
}
