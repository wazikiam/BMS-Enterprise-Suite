// packages/server/src/api/ledgerBalanceSnapshot.routes.ts

import { Router, Request, Response } from 'express';
import { LedgerBalanceSnapshotController } from './LedgerBalanceSnapshotController';

/**
 * READ-ONLY routes for ledger balance snapshots.
 *
 * No writes.
 * No auth.
 * No Postgres.
 */
export function ledgerBalanceSnapshotRoutes(
  controller: LedgerBalanceSnapshotController
): Router {
  const router = Router();

  // TEMP — Snapshot list (read-only, in-memory only)
  router.get('/snapshots', (_req: Request, res: Response) => {
    res.json([]);
  });

  router.get(
    '/ledger-balance/snapshots/:snapshotId',
    controller.getBalanceAsOfSnapshot.bind(controller)
  );

  return router;
}
