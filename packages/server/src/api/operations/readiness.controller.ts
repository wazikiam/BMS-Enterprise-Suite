// packages/server/src/api/operations/readiness.controller.ts

import { Request, Response } from 'express';

interface ReadinessCheckResult {
  ok: boolean;
  degraded: boolean;
  reasons: string[];
}

/**
 * ReadinessController
 *
 * Reports whether the system is safe to receive traffic.
 * This endpoint enforces the Health & Readiness Contract.
 *
 * IMPORTANT:
 * - Missing runtime snapshots are NOT a readiness failure
 * - Inability to enforce governance IS a readiness failure
 */
export class ReadinessController {
  static check(req: Request, res: Response): void {
    const startTime = process.uptime();

    const checks: ReadinessCheckResult = {
      ok: true,
      degraded: false,
      reasons: [],
    };

    // ---- Governance enforcement availability ----
    // If guards are not wired, the system is NOT ready
    try {
      // Presence check only; no execution
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require('../../guards/snapshotEligibility.guard');
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require('../../guards/snapshotRetention.guard');
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require('../../guards/exportTruth.guard');
    } catch {
      checks.ok = false;
      checks.reasons.push('Governance guards unavailable');
    }

    // ---- Snapshot runtime availability (degraded, not failed) ----
    const runtimeSnapshotsAvailable =
      typeof (global as any).__RUNTIME_SNAPSHOT_STORE__ !== 'undefined';

    if (!runtimeSnapshotsAvailable) {
      checks.degraded = true;
      checks.reasons.push('Runtime snapshot store not initialized');
    }

    // ---- Build response ----
    if (!checks.ok) {
      res.status(503).json({
        status: 'NOT_READY',
        mode: 'UNSAFE',
        uptimeSeconds: startTime,
        reasons: checks.reasons,
      });
      return;
    }

    res.status(200).json({
      status: 'READY',
      mode: checks.degraded ? 'DEGRADED' : 'LIVE',
      uptimeSeconds: startTime,
      reasons: checks.reasons,
    });
  }
}
