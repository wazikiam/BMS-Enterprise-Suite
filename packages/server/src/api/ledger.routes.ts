// packages/server/src/api/ledger.routes.ts
// LEDGER EVENTS WRITE API (APPEND-ONLY, GOVERNED)
//
// - Actor enforced (from middleware)
// - Idempotent
// - Period hard-gated (CLOSED / LOCKED)
// - Append-only
// - Deterministic
// - Audit-grade

import { Router, Request, Response } from 'express';
import { getPostgresPool } from '../db/PostgresClient';

import { createIdempotencyMiddleware } from './IdempotencyMiddleware';
import { IdempotencyStore } from './IdempotencyStore';

import { PostgresLedgerEventRepository } from './PostgresLedgerEventRepository';
import { PostgresFinancialPeriodEventRepository } from './PostgresFinancialPeriodEventRepository';
import {
  FinancialPeriodGate,
  PeriodClosedError,
} from './FinancialPeriodGate';

import {
  LedgerWriteCommand,
  LedgerWriteActor,
} from '@bms/core/src/ledger/LedgerWriteGateway';

export function createLedgerRoutes(): Router {
  const router = Router();
  const pool = getPostgresPool();

  const idempotency = createIdempotencyMiddleware(
    new IdempotencyStore(pool)
  );

  const ledgerRepo = new PostgresLedgerEventRepository(pool);
  const periodGate = new FinancialPeriodGate(
    new PostgresFinancialPeriodEventRepository(pool)
  );

  router.post(
    '/events',
    idempotency,
    async (req: Request, res: Response) => {
      try {
        // ─────────────────────────────────────────────────────────
        // ACTOR (FAIL-CLOSED, CANONICAL SHAPE)
        // ─────────────────────────────────────────────────────────

        const actorCtx = (req as any).actor;
        if (!actorCtx) {
          return res.status(403).json({
            error: 'Forbidden: actor identity required',
          });
        }

        const actor: LedgerWriteActor = {
          actorId: actorCtx.actorId, // ✅ CORRECT
          roles: actorCtx.roles,
        };

        // ─────────────────────────────────────────────────────────
        // PARSE BODY
        // ─────────────────────────────────────────────────────────

        const body = req.body ?? {};

        const occurredAt = new Date(body.occurredAt);
        if (Number.isNaN(occurredAt.getTime())) {
          return res.status(400).json({
            error: 'Invalid occurredAt',
          });
        }

        // ─────────────────────────────────────────────────────────
        // HARD FINANCIAL PERIOD GATE
        // ─────────────────────────────────────────────────────────

        await periodGate.assertAllowsLedgerWrite(occurredAt);

        // ─────────────────────────────────────────────────────────
        // BUILD COMMAND (NO ACTOR FIELDS HERE)
        // ─────────────────────────────────────────────────────────

        const cmd: LedgerWriteCommand = {
          eventId: body.eventId,
          journalId: body.journalId,
          eventType: body.eventType,
          occurredAt,

          accountCode: body.accountCode,
          debitAmount: body.debitAmount,
          creditAmount: body.creditAmount,
          currency: body.currency,

          reason: body.reason,
        };

        const event = await ledgerRepo.append(cmd, actor);

        return res.status(201).json({
          eventId: event.eventId,
        });
      } catch (err: any) {
        if (err instanceof PeriodClosedError) {
          return res.status(409).json({
            error: 'Ledger write rejected: financial period closed',
            periodId: err.periodId,
            periodFrom: err.periodFrom,
            periodTo: err.periodTo,
          });
        }

        return res.status(400).json({
          error: 'Ledger event rejected',
          reason: err?.message ?? 'Unknown error',
        });
      }
    }
  );

  return router;
}
