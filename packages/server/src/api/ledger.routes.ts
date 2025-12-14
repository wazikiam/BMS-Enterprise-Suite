// packages/server/src/api/ledger.routes.ts

import { Router } from 'express';
import { LedgerPostingController } from './LedgerPostingController';

export function createLedgerRoutes(
  controller: LedgerPostingController
): Router {
  const router = Router();

  router.post(
    '/postings',
    (req, res, next) =>
      controller.create(req, res).catch(next)
  );

  return router;
}
