// packages/server/src/api/internal/snapshotVaultRetention.routes.ts

import { Router } from 'express';
import { SnapshotVaultRetentionController } from './snapshotVaultRetention.controller';

export function createSnapshotVaultRetentionRouter(
  controller: SnapshotVaultRetentionController
): Router {
  const router = Router();

  router.post('/retention', controller.setPolicy);
  router.get('/retention/:name', controller.getLatestPolicy);
  router.get('/retention/:name/dry-run', controller.dryRun);

  return router;
}
