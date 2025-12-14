// packages/server/src/routes/reporting/index.ts

import { Router } from 'express';
import { randomUUID } from 'crypto';

import { createReportingProvider } from '../../api/reportingProvider';

const router = Router();

/**
 * Reporting provider composition.
 * This wires core reporting logic to infrastructure adapters.
 */
const reportingProvider = createReportingProvider();

/**
 * Generate and persist a new reporting snapshot.
 *
 * This endpoint is generation-only.
 * Querying semantics are handled separately.
 */
router.post('/snapshots', async (req, res, next) => {
  try {
    const {
      periodFrom,
      periodTo,
      asOf,
    }: {
      periodFrom?: string;
      periodTo?: string;
      asOf?: string;
    } = req.body ?? {};

    if (!periodFrom || !periodTo || !asOf) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['periodFrom', 'periodTo', 'asOf'],
      });
    }

    const snapshot = await reportingProvider.snapshotService.generate({
      snapshotId: randomUUID(),
      periodFrom: new Date(periodFrom),
      periodTo: new Date(periodTo),
      asOf: new Date(asOf),
    });

    res.status(201).json(snapshot);
  } catch (error) {
    next(error);
  }
});

/**
 * Snapshot retrieval endpoint.
 *
 * Temporarily disabled.
 * Proper period-based querying and supersession semantics
 * will be introduced in Week 13.
 */
router.get('/snapshots/latest', async (_req, res) => {
  res.status(501).json({
    error: 'Not implemented',
    reason:
      'Snapshot querying is disabled. ' +
      'Period-aware and version-safe querying will be implemented in Week 13.',
  });
});

export default router;
