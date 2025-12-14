// packages/server/src/routes/index.ts

import { Router } from 'express';
import { reportingRouter } from './reporting';

export const routes = Router();

/**
 * Root API routes.
 * This file composes feature routers only.
 */
routes.use('/reporting', reportingRouter);
