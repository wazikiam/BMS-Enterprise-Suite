// packages/server/src/api/ledgerBalance.routes.ts

import { Router } from 'express';
import { LedgerBalanceController } from './LedgerBalanceController';
import { LedgerBalanceProvider } from './ledgerBalanceProvider';
import { FinancialPeriodReadModel } from './FinancialPeriodReadModel';

export function createLedgerBalanceRoutes(
  provider: LedgerBalanceProvider,
  financialPeriodReadModel: FinancialPeriodReadModel
): Router {
  const router = Router();

  const controller = new LedgerBalanceController(
    provider.ledgerBalanceQuery,
    financialPeriodReadModel
  );

  /**
   * GET /api/ledger/balances
   *
   * Query params:
   * - accountId (required)
   * - currency (required)
   * - periodFrom (optional, ISO)
   * - periodTo (optional, ISO)
   * - asOf (optional, ISO)
   */
  router.get('/balances', (req, res) =>
    controller.getBalance(req, res)
  );

  return router;
}
