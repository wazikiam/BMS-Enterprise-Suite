// packages/server/src/api/ledgerBalanceSnapshot.routes.ts

import { Router } from 'express';
import { LedgerBalanceSnapshotController } from './LedgerBalanceSnapshotController';

export function ledgerBalanceSnapshotRoutes(
  controller: LedgerBalanceSnapshotController
): Router {
  const router = Router();

  router.get(
    '/ledger-balances/snapshots/:snapshotId',
    controller.getBalanceAsOfSnapshot.bind(controller)
  );

  return router;
}
