import { Router } from 'express';
import { randomUUID } from 'crypto';
import { createReportingProvider } from '../../api/reportingProvider';

const router = Router();

// Compose reporting provider once per process
const reportingProvider = createReportingProvider();

/**
 * POST /api/reports/snapshots
 *
 * For now, this endpoint generates a SALES_KPI snapshot
 * for the current month.
 */
router.post('/snapshots', async (req, res, next) => {
  try {
    const now = new Date();

    const periodFrom = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodTo = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const snapshot = await reportingProvider.snapshotService.generate({
      snapshotId: randomUUID(),
      periodFrom,
      periodTo,
      asOf: now,
      now,
    });

    res.status(201).json(snapshot);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/reports/snapshots/latest?snapshotType=SALES_KPI
 *
 * Snapshot type is currently informational only.
 */
router.get('/snapshots/latest', async (req, res, next) => {
  try {
    const snapshotType = req.query.snapshotType as string | undefined;

    if (!snapshotType) {
      return res.status(400).json({
        error: 'snapshotType query parameter is required',
        example: '/api/reports/snapshots/latest?snapshotType=SALES_KPI',
      });
    }

    const snapshot =
      await reportingProvider.snapshotRepository.getLatest(snapshotType);

    if (!snapshot) {
      return res.status(404).json({
        error: 'No snapshot found for given snapshotType',
        snapshotType,
      });
    }

    res.json(snapshot);
  } catch (error) {
    next(error);
  }
});

export default router;
