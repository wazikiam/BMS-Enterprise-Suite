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
 * - First request with key → response is recorded
 * - Replay with SAME payload → stored response returned
 * - Replay with DIFFERENT payload → 409 Conflict
 *
 * This middleware is:
 * - Transport-layer only
 * - Deterministic
 * - Append-only
 */
export function createIdempotencyMiddleware(
  store: IdempotencyStore
) {
  return async function idempotencyMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    const key = req.header('Idempotency-Key');
    if (!key) {
      return next();
    }

    const requestHash = IdempotencyStore.hashRequest(req.body);

    const existing = await store.get(key);

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

    let responseBody: unknown;
    let statusCode = 200;

    res.status = (code: number) => {
      statusCode = code;
      return originalStatus(code);
    };

    res.json = (body: unknown) => {
      responseBody = body;
      return originalJson(body);
    };

    res.on('finish', async () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        await store.store({
          key,
          requestHash,
          responseBody,
          statusCode,
        });
      }
    });

    next();
  };
}
