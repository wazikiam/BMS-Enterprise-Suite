// packages/server/src/api/arPayments/arPaymentWrite.routes.ts
//
// BMS Enterprise Suite — Server API
// Phase 4.5 — AR Payments
//
// WRITE-SIDE ROUTES ONLY
// - Idempotent (REQUIRED)
// - Fail-closed on missing Idempotency-Key
// - No business logic
// - Delegates to handler

import { Router, Request, Response, NextFunction } from 'express';
import { getPostgresPool } from '../../db/PostgresClient';

import { createIdempotencyMiddleware } from '../IdempotencyMiddleware';
import { IdempotencyStore } from '../IdempotencyStore';

import { handleARPaymentCommand } from '../../ar/payments/arPaymentWriteHandler';

function requireIdempotencyKey(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const key = req.header('Idempotency-Key');
  if (!key) {
    return res.status(400).json({
      error: 'Missing Idempotency-Key header',
      rule: 'AR payment commands must be idempotent',
    });
  }
  return next();
}

export function createARPaymentWriteRoutes(): Router {
  const router = Router();

  const pool = getPostgresPool();
  const idempotency = createIdempotencyMiddleware(
    new IdempotencyStore(pool)
  );

  // POST /api/ar/payments/commands (IDEMPOTENT — REQUIRED)
  router.post(
    '/commands',
    requireIdempotencyKey,
    idempotency,
    handleARPaymentCommand
  );

  return router;
}
