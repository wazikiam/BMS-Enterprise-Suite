// packages/server/src/api/trialBalance.routes.ts
// TRIAL BALANCE ROUTES
// - Read-only
// - Mounted under /api/ledger
// - Actor injection enforced globally

import { Router } from 'express';
import { TrialBalanceController } from './TrialBalanceController';

export function createTrialBalanceRoutes(
  controller: TrialBalanceController
): Router {
  const router = Router();

  router.get('/trial-balance', (req, res) =>
    controller.getTrialBalance(req, res)
  );

  return router;
}
