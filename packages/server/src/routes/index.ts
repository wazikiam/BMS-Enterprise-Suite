// packages/server/src/routes/index.ts

import { Router } from 'express';

// Operations (health / readiness)
import operationsRoutes from '../api/operations/operations.routes';

// Reporting routes
import reportingRouter from './reporting';

// Finance routes (READ + WRITE)
import { createFinancePeriodsRoutes } from '../api/financePeriods.routes';

const router = Router();

/**
 * Operations endpoints
 * Must be available regardless of business route readiness
 */
router.use('/', operationsRoutes);

/**
 * Finance domain (governed)
 */
router.use('/finance', createFinancePeriodsRoutes());

/**
 * Reporting domain
 */
router.use('/reporting', reportingRouter);

export default router;
