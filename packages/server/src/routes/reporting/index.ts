import { Router } from 'express';
import { createReportingProvider } from '../../api/reportingProvider';

const router = Router();

// Compose reporting provider once per process
const reportingProvider = createReportingProvider();

/**
 * POST /api/reports/snapshots
 * Generate a new snapshot for a given snapshot type
 */
router.post('/snapshots', async (req, res, next) => {
  try {
    const { snapshotType } = req.body as { snapshotType?: string };

    if (!snapshotType) {
      return res.status(400).json({
        error: 'snapshotType is required',
        example: {
          snapshotType: 'SALES_KPI',
        },
      });
    }

    const snapshot =
      await reportingProvider.snapshotService.generateSnapshot(snapshotType);

    res.status(201).json(snapshot);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/reports/snapshots/latest?snapshotType=SALES_KPI
 * Retrieve the latest snapshot for a given snapshot type
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
