// packages/server/src/middleware/requestMetrics.middleware.ts

import { Request, Response, NextFunction } from 'express';

interface MetricsCounters {
  total: number;
  errors4xx: number;
  errors5xx: number;
  totalLatencyMs: number;
  completed: number;
}

const counters: MetricsCounters = {
  total: 0,
  errors4xx: 0,
  errors5xx: 0,
  totalLatencyMs: 0,
  completed: 0,
};

/**
 * requestMetricsMiddleware
 *
 * Lightweight request instrumentation.
 * - No payload inspection
 * - No business logic impact
 * - Safe for production
 */
export function requestMetricsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const start = process.hrtime.bigint();
  counters.total += 1;

  res.on('finish', () => {
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1_000_000;

    counters.completed += 1;
    counters.totalLatencyMs += durationMs;

    if (res.statusCode >= 400 && res.statusCode < 500) {
      counters.errors4xx += 1;
    }

    if (res.statusCode >= 500) {
      counters.errors5xx += 1;
    }
  });

  next();
}

/**
 * Read-only accessor for metrics controller
 */
export function getRequestMetricsSnapshot() {
  return {
    total: counters.total,
    errors4xx: counters.errors4xx,
    errors5xx: counters.errors5xx,
    avgResponseMs:
      counters.completed > 0
        ? Math.round(counters.totalLatencyMs / counters.completed)
        : null,
  };
}
