// packages/server/src/api/financePeriods.read.routes.ts
// FINANCIAL PERIODS — READ API (READ MODEL)
//
// - Deterministic
// - Actor-protected (middleware enforced upstream)
// - Read-only
// - Event-sourced
// - Governance-correct

import { Router, Request, Response } from 'express';
import { getPostgresPool } from '../db/PostgresClient';
import { PostgresFinancialPeriodEventRepository } from './PostgresFinancialPeriodEventRepository';
import { FinancialPeriodStateProjector } from '@bms/core/src/finance/FinancialPeriodStateProjector';

const router = Router();

/**
 * GET /api/finance/periods
 *
 * Returns all financial periods derived from the
 * append-only financial_period_events stream.
 */
router.get('/periods', async (_req: Request, res: Response) => {
  try {
    const pool = getPostgresPool();

    const repo = new PostgresFinancialPeriodEventRepository(pool);

    // 1. Load ALL events (append-only, ordered in repo)
    const events = await repo.listAll();

    // 2. Project deterministic read model
    const index = FinancialPeriodStateProjector.projectAll(events);

    // 3. Serialize response
    res.json({
      periods: index.periods.map((p) => ({
        periodId: p.periodId,
        periodFrom: p.periodFrom,
        periodTo: p.periodTo,
        label: p.label,
        status: p.status,
        legalHold: p.legalHold,
      })),
    });
  } catch (err: any) {
    res.status(500).json({
      error: 'Failed to read financial periods',
      reason: err.message,
    });
  }
});

export default router;
