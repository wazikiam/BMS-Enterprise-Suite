// packages/server/src/api/operations/operations.routes.ts

import { Router } from 'express';
import { ReadinessController } from './readiness.controller';
import { MetricsController } from './metrics.controller';

const router = Router();

/**
 * Liveness endpoint (process-level only)
 */
router.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ALIVE' });
});

/**
 * Readiness endpoint (contract-enforced)
 */
router.get('/ready', ReadinessController.check);

/**
 * Metrics endpoint (read-only, operator protected)
 */
router.get('/metrics', MetricsController.get);

export default router;
