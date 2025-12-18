// packages/server/src/api/financePeriods.command.routes.ts
// FINANCIAL PERIOD COMMAND API (WRITE, GOVERNED)
//
// Endpoints:
// POST   /api/finance/periods
// POST   /api/finance/periods/:periodId/close
// POST   /api/finance/periods/:periodId/reopen
// POST   /api/finance/periods/:periodId/legal-hold
// DELETE /api/finance/periods/:periodId/legal-hold
//
// Rules:
// - Actor enforced (fail-closed)
// - Idempotent
// - Append-only
// - Deterministic
// - Event-sourced
// - NO `any`

import { Router, Request, Response } from 'express';
import { getPostgresPool } from '../db/PostgresClient';
import { FinancialPeriodGateway } from '@bms/core/src/finance/FinancialPeriodGateway';
import { PostgresFinancialPeriodEventRepository } from './PostgresFinancialPeriodEventRepository';
import { createIdempotencyMiddleware } from './IdempotencyMiddleware';
import { IdempotencyStore } from './IdempotencyStore';

const router = Router();
const pool = getPostgresPool();
const repo = new PostgresFinancialPeriodEventRepository(pool);
const idempotencyStore = new IdempotencyStore(pool);

function requireActor(req: Request): { actorId: string; actorRoles: string[] } {
  const actorId = req.header('X-Actor-Id');
  const rolesHeader = req.header('X-Actor-Roles');

  if (!actorId || !rolesHeader) {
    throw new Error('Forbidden: actor identity required');
  }

  const actorRoles = rolesHeader
    .split(',')
    .map(r => r.trim())
    .filter(Boolean);

  if (actorRoles.length === 0) {
    throw new Error('Forbidden: actor roles required');
  }

  return { actorId, actorRoles };
}

// ─────────────────────────────────────────────
// CREATE PERIOD
// ─────────────────────────────────────────────
router.post(
  '/periods',
  createIdempotencyMiddleware(idempotencyStore),
  async (req: Request, res: Response) => {
    try {
      const { actorId, actorRoles } = requireActor(req);

      const event = FinancialPeriodGateway.buildEvent({
        type: 'CREATE_FINANCIAL_PERIOD',
        periodId: req.body.periodId,
        periodFrom: new Date(req.body.periodFrom),
        periodTo: new Date(req.body.periodTo),
        label: req.body.label,
        actorId,
        actorRoles,
        reason: req.body.reason,
      });

      await repo.append(event);

      res.status(201).json({ periodId: event.periodId });
    } catch (err: any) {
      res.status(400).json({
        error: 'Financial period creation rejected',
        reason: err.message,
      });
    }
  }
);

// ─────────────────────────────────────────────
// CLOSE PERIOD
// ─────────────────────────────────────────────
router.post(
  '/periods/:periodId/close',
  createIdempotencyMiddleware(idempotencyStore),
  async (req: Request, res: Response) => {
    try {
      const { actorId, actorRoles } = requireActor(req);

      const event = FinancialPeriodGateway.buildEvent({
        type: 'CLOSE_FINANCIAL_PERIOD',
        periodId: req.params.periodId,
        actorId,
        actorRoles,
        reason: req.body?.reason,
      });

      await repo.append(event);

      res.status(200).json({ periodId: event.periodId });
    } catch (err: any) {
      res.status(400).json({
        error: 'Financial period close rejected',
        reason: err.message,
      });
    }
  }
);

// ─────────────────────────────────────────────
// REOPEN PERIOD
// ─────────────────────────────────────────────
router.post(
  '/periods/:periodId/reopen',
  createIdempotencyMiddleware(idempotencyStore),
  async (req: Request, res: Response) => {
    try {
      const { actorId, actorRoles } = requireActor(req);

      const event = FinancialPeriodGateway.buildEvent({
        type: 'REOPEN_FINANCIAL_PERIOD',
        periodId: req.params.periodId,
        actorId,
        actorRoles,
        reason: req.body?.reason,
      });

      await repo.append(event);

      res.status(200).json({ periodId: event.periodId });
    } catch (err: any) {
      res.status(400).json({
        error: 'Financial period reopen rejected',
        reason: err.message,
      });
    }
  }
);

// ─────────────────────────────────────────────
// LEGAL HOLD — SET
// ─────────────────────────────────────────────
router.post(
  '/periods/:periodId/legal-hold',
  createIdempotencyMiddleware(idempotencyStore),
  async (req: Request, res: Response) => {
    try {
      const { actorId, actorRoles } = requireActor(req);

      const event = FinancialPeriodGateway.buildEvent({
        type: 'SET_FINANCIAL_PERIOD_LEGAL_HOLD',
        periodId: req.params.periodId,
        actorId,
        actorRoles,
        reason: req.body?.reason,
      });

      await repo.append(event);

      res.status(200).json({ periodId: event.periodId });
    } catch (err: any) {
      res.status(400).json({
        error: 'Legal hold set rejected',
        reason: err.message,
      });
    }
  }
);

// ─────────────────────────────────────────────
// LEGAL HOLD — CLEAR
// ─────────────────────────────────────────────
router.delete(
  '/periods/:periodId/legal-hold',
  createIdempotencyMiddleware(idempotencyStore),
  async (req: Request, res: Response) => {
    try {
      const { actorId, actorRoles } = requireActor(req);

      const event = FinancialPeriodGateway.buildEvent({
        type: 'CLEAR_FINANCIAL_PERIOD_LEGAL_HOLD',
        periodId: req.params.periodId,
        actorId,
        actorRoles,
        reason: req.body?.reason,
      });

      await repo.append(event);

      res.status(200).json({ periodId: event.periodId });
    } catch (err: any) {
      res.status(400).json({
        error: 'Legal hold clear rejected',
        reason: err.message,
      });
    }
  }
);

export default router;
