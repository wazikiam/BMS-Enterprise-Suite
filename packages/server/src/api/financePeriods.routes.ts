// packages/server/src/api/financePeriods.routes.ts
// FINANCIAL PERIOD ROUTES (READ + WRITE)
//
// Base path: /api/finance
//
// READ:
//   GET    /periods
//
// WRITE (GOVERNED):
//   POST   /periods
//   POST   /periods/:periodId/close
//   POST   /periods/:periodId/reopen
//   POST   /periods/:periodId/legal-hold
//   DELETE /periods/:periodId/legal-hold
//
// Rules:
// - Actor enforced (middleware / headers)
// - Event-sourced
// - Append-only
// - Deterministic

import { Router } from 'express';
import { createFinancePeriodsCommandRoutes } from './financePeriods.commands.routes';
import { getPostgresPool } from '../db/PostgresClient';
import { PostgresFinancialPeriodEventRepository } from './PostgresFinancialPeriodEventRepository';
import { FinancialPeriodStateProjector } from './FinancialPeriodStateProjector';

export function createFinancePeriodsRoutes(): Router {
  const router = Router();

  // ─────────────────────────────────────────────
  // READ ROUTES
  // ─────────────────────────────────────────────
  const pool = getPostgresPool();
  const repo = new PostgresFinancialPeriodEventRepository(pool);

  router.get('/periods', async (_req, res) => {
    try {
      const events = await repo.listAll();

      const byPeriod = new Map<string, any[]>();
      for (const e of events) {
        const list = byPeriod.get(e.periodId) ?? [];
        list.push(e);
        byPeriod.set(e.periodId, list);
      }

      const periods = [];

      for (const evs of byPeriod.values()) {
        evs.sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());
        try {
          periods.push(FinancialPeriodStateProjector.project(evs));
        } catch {
          // tolerate incomplete sequences
        }
      }

      periods.sort(
        (a, b) => a.periodFrom.getTime() - b.periodFrom.getTime()
      );

      return res.json({ periods });
    } catch (err: any) {
      return res.status(503).json({
        error: 'Financial period read unavailable',
        reason: err?.message ?? 'Unknown error',
      });
    }
  });

  // ─────────────────────────────────────────────
  // WRITE ROUTES (COMMANDS)
  // ─────────────────────────────────────────────
  router.use(createFinancePeriodsCommandRoutes());

  return router;
}
