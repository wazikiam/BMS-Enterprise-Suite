// packages/server/src/api/financialSnapshots.routes.ts
// FINANCIAL SNAPSHOT READ ROUTES
//
// Base: /api/finance/snapshots
// READ ONLY

import { Router } from 'express';
import { getPostgresPool } from '../db/PostgresClient';
import { FinancialSnapshotReadRepository } from './financial-snapshots/FinancialSnapshotReadRepository';
import { FinancialSnapshotReadController } from './financial-snapshots/FinancialSnapshotReadController';

export function createFinancialSnapshotReadRoutes(): Router {
  const router = Router();

  const pool = getPostgresPool();
  const repository = new FinancialSnapshotReadRepository(pool);
  const controller = new FinancialSnapshotReadController(repository);

  router.get('/', controller.listSnapshots.bind(controller));
  router.get('/:snapshotId', controller.getSnapshotById.bind(controller));

  return router;
}
