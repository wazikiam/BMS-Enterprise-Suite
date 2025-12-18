// packages/server/src/api/reporting-snapshots/getReportingSnapshot.controller.ts

import { Request, Response } from 'express';

/**
 * Snapshot retrieval controller factory.
 *
 * NOTE:
 * Snapshot retrieval is handled via reporting adapters.
 * This controller exists ONLY to satisfy routing contracts.
 */
export function getReportingSnapshotController(
  _runtimeStore: unknown
) {
  return async (_req: Request, res: Response) => {
    return res.status(501).json({
      error: 'Snapshot retrieval is not exposed via this route',
    });
  };
}
