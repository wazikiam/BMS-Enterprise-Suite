// packages/server/src/routes/reporting/index.ts

import { Router } from 'express';
import { createReportingProvider } from '../../api/reportingProvider';
import { GenerateSnapshotRequest } from '../../api/reportingSnapshot.dto';

const router = Router();
const reporting = createReportingProvider();

/**
 * POST /reporting/snapshots
 * Generates an immutable reporting snapshot
 */
router.post('/snapshots', async (req, res) => {
  const body = req.body as GenerateSnapshotRequest;

  if (!body.snapshotId || !body.periodFrom || !body.periodTo || !body.asOf) {
    return res.status(400).json({ error: 'Invalid snapshot request payload' });
  }

  try {
    const snapshot = await reporting.snapshotService.generate({
      snapshotId: body.snapshotId,
      periodFrom: new Date(body.periodFrom),
      periodTo: new Date(body.periodTo),
      asOf: new Date(body.asOf),
    });

    return res.status(201).json(snapshot);
  } catch (err) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Snapshot generation failed',
    });
  }
});

/**
 * GET /reporting/snapshots/latest
 */
router.get('/snapshots/latest', async (_req, res) => {
  const snapshot = await reporting.snapshotRepository.getLatest();

  if (!snapshot) {
    return res.status(404).json({ error: 'No snapshots available' });
  }

  return res.json(snapshot);
});

export default router;
