// packages/server/src/api/operations/metrics.controller.ts

import { Request, Response } from 'express';
import { getRequestMetricsSnapshot } from '../../middleware/requestMetrics.middleware';

/**
 * MetricsController
 *
 * Read-only operational metrics.
 * MUST NOT expose business data, identifiers, or snapshot payloads.
 */
export class MetricsController {
  static get(req: Request, res: Response): void {
    // Identity and authority enforcement (fail closed)
    const actor = (req as any).actor;

    if (!actor || !actor.id || !Array.isArray(actor.roles)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const roles = actor.roles as string[];
    const allowed = roles.includes('SYSTEM_OPERATOR') || roles.includes('SYSTEM_ADMIN');

    if (!allowed) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const mem = process.memoryUsage();

    // Snapshot runtime store presence (no payload, no IDs)
    const runtimeStore = (global as any).__RUNTIME_SNAPSHOT_STORE__;
    const runtimeStorePresent = typeof runtimeStore !== 'undefined' && runtimeStore !== null;

    let runtimeSnapshotCount: number | null = null;

    try {
      if (runtimeStorePresent && typeof runtimeStore === 'object') {
        if (typeof (runtimeStore as any).size === 'number') {
          runtimeSnapshotCount = (runtimeStore as any).size;
        } else if (Array.isArray((runtimeStore as any).snapshots)) {
          runtimeSnapshotCount = (runtimeStore as any).snapshots.length;
        }
      }
    } catch {
      runtimeSnapshotCount = null;
    }

    const requestMetrics = getRequestMetricsSnapshot();

    res.status(200).json({
      status: 'OK',
      process: {
        uptimeSeconds: process.uptime(),
        nodeVersion: process.version,
        pid: process.pid,
        memory: {
          rss: mem.rss,
          heapTotal: mem.heapTotal,
          heapUsed: mem.heapUsed,
          external: mem.external,
        },
      },
      requests: requestMetrics,
      snapshots: {
        runtimeStorePresent,
        runtimeSnapshotCount,
        vaultConnectivity: null,
      },
    });
  }
}
