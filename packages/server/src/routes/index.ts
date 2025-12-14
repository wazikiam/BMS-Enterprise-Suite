// packages/server/src/routes/index.ts

import { Router } from 'express';
import reportingRouter from './reporting';

const router = Router();

router.use('/reporting', reportingRouter);

export default router;
