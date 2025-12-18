// packages/server/src/api/IdempotencyMiddleware.ts

import { Request, Response, NextFunction } from 'express';
import { IdempotencyStore } from './IdempotencyStore';

/**
 * IdempotencyMiddleware
 *
 * Enforces HTTP idempotency using the Idempotency-Key header.
 *
 * Rules:
 * - Missing Idempotency-Key → request proceeds normally
 * - First request with key → response is recorded (on successful 2xx)
 * - Replay with SAME payload → stored response returned
 * - Replay with DIFFERENT payload → 409 Conflict
 *
 * Enterprise guarantees:
 * - Must NEVER crash the server process
 * - Store I/O failures must be contained and surfaced deterministically
 */
export function createIdempotencyMiddleware(store: IdempotencyStore) {
  return async function idempotencyMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    const key = req.header('Idempotency-Key');
    if (!key) {
      return next();
    }

    let requestHash: string;
    try {
      requestHash = IdempotencyStore.hashRequest(req.body);
    } catch (err: any) {
      // Hashing must be deterministic; if it fails, this request is invalid.
      return res.status(400).json({
        error: 'Invalid request payload for idempotency hashing',
        reason: err?.message ?? 'Unknown error',
      });
    }

    let existing: any;
    try {
      existing = await store.get(key);
    } catch (err: any) {
      // Fail-closed on idempotency infrastructure errors.
      return res.status(503).json({
        error: 'Idempotency store unavailable',
        reason: err?.message ?? 'Unknown error',
      });
    }

    if (existing) {
      if (existing.requestHash !== requestHash) {
        return res.status(409).json({
          error: 'Idempotency key reuse with different request payload',
        });
      }

      return res.status(existing.statusCode).json(existing.responseBody);
    }

    // Capture response for storage
    const originalJson = res.json.bind(res);
    const originalStatus = res.status.bind(res);

    let responseBody: unknown = undefined;
    let statusCode = 200;

    res.status = (code: number) => {
      statusCode = code;
      return originalStatus(code);
    };

    res.json = (body: unknown) => {
      responseBody = body;
      return originalJson(body);
    };

    // IMPORTANT: Do not use an async listener directly (crash risk on rejection).
    res.on('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // Fire-and-contain: must never crash the process.
        void store
          .store({
            key,
            requestHash,
            responseBody,
            statusCode,
          })
          .catch((err: any) => {
            // Deterministic containment: log only; do not throw.
            // This preserves "no silent heal" while preventing process termination.
            // Operator can observe logs and investigate store failures.
            // eslint-disable-next-line no-console
            console.error('[IdempotencyMiddleware] store.store failed', {
              key,
              reason: err?.message ?? String(err),
            });
          });
      }
    });

    return next();
  };
}
