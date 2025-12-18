// packages/server/src/api/reporting-snapshots/createReportingSnapshot.controller.ts

import { Request, Response } from 'express';

/**
 * Snapshot creation controller factory.
 *
 * NOTE:
 * Snapshot creation is governed elsewhere.
 * This controller exists ONLY to satisfy routing contracts.
 * It MUST accept runtimeStore to preserve architectural consistency.
 */
export function createReportingSnapshotController(
  _runtimeStore: unknown
) {
  return async (_req: Request, res: Response) => {
    return res.status(501).json({
      error: 'Snapshot creation is not exposed via this route',
    });
  };
}
