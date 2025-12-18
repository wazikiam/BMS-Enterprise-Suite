// packages/server/src/routes/reporting/index.ts

import { Router } from 'express';
import { randomUUID } from 'crypto';

import { createReportingProvider } from '../../api/reportingProvider';

const router = Router();

/**
 * Reporting provider (SHARED snapshot store).
 */
const reportingProvider = createReportingProvider();

/**
 * POST /api/reports/snapshots
 * Generate a new reporting snapshot.
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
 * GET /api/reports/snapshots
 * List ALL snapshots (read-only).
 */
router.get('/snapshots', async (_req, res) => {
  const snapshots = await reportingProvider.snapshotRepository.list();

  res.json(
    snapshots.map((s) => ({
      snapshotId: s.snapshotId,
      periodFrom: s.period.from,
      periodTo: s.period.to,
      asOf: s.asOf,
      generatedAt: s.generatedAt,
    }))
  );
});

/**
 * GET /api/reports/snapshots/:snapshotId
 * Fetch ONE snapshot by ID.
 */
router.get('/snapshots/:snapshotId', async (req, res) => {
  const { snapshotId } = req.params;

  const snapshot =
    await reportingProvider.snapshotRepository.getById(snapshotId);

  if (!snapshot) {
    return res.status(404).json({
      error: 'Snapshot not found',
      snapshotId,
    });
  }

  res.json(snapshot);
});

export default router;
