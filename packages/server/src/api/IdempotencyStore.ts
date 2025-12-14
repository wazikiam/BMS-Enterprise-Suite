// packages/server/src/api/IdempotencyStore.ts

import crypto from 'crypto';
import { Pool } from 'pg';
import { getPostgresPool } from '../db/PostgresClient';

/**
 * IdempotencyRecord
 *
 * Represents a finalized HTTP response bound to an idempotency key.
 * This table is append-only by PRIMARY KEY constraint.
 */
export interface IdempotencyRecord {
  key: string;
  requestHash: string;
  responseBody: unknown;
  statusCode: number;
  createdAt: Date;
}

/**
 * IdempotencyStore
 *
 * Infrastructure-only component.
 *
 * Guarantees:
 * - Same idempotency key + same request payload → same response
 * - Same idempotency key + DIFFERENT payload → REJECT
 * - No updates
 * - No deletes
 * - Fully auditable
 *
 * This is NOT business logic.
 * This is HTTP safety infrastructure.
 */
export class IdempotencyStore {
  private readonly pool: Pool;

  constructor(pool?: Pool) {
    this.pool = pool ?? getPostgresPool();
  }

  /**
   * Compute a deterministic hash of the request payload.
   * Order-sensitive by design.
   */
  static hashRequest(payload: unknown): string {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(payload), 'utf8')
      .digest('hex');
  }

  /**
   * Fetch an existing idempotency record by key.
   */
  async get(key: string): Promise<IdempotencyRecord | null> {
    const sql = `
      SELECT
        key,
        request_hash,
        response_body,
        status_code,
        created_at
      FROM http_idempotency_keys
      WHERE key = $1
      LIMIT 1
    `;

    const res = await this.pool.query(sql, [key]);

    if (res.rowCount === 0) return null;

    const row = res.rows[0];

    return {
      key: row.key,
      requestHash: row.request_hash,
      responseBody: row.response_body,
      statusCode: row.status_code,
      createdAt: row.created_at,
    };
  }

  /**
   * Persist a finalized HTTP response.
   *
   * If the key already exists:
   * - SAME request hash → caller must reuse stored response
   * - DIFFERENT request hash → throw (client error)
   */
  async store(params: {
    key: string;
    requestHash: string;
    responseBody: unknown;
    statusCode: number;
  }): Promise<void> {
    const sql = `
      INSERT INTO http_idempotency_keys (
        key,
        request_hash,
        response_body,
        status_code
      )
      VALUES ($1, $2, $3::jsonb, $4)
    `;

    try {
      await this.pool.query(sql, [
        params.key,
        params.requestHash,
        JSON.stringify(params.responseBody),
        params.statusCode,
      ]);
    } catch (err: any) {
      // PRIMARY KEY violation → key already exists
      if (err.code === '23505') {
        const existing = await this.get(params.key);

        if (!existing) {
          throw err; // impossible, but fail hard
        }

        if (existing.requestHash !== params.requestHash) {
          throw new Error(
            `Idempotency key reuse with different request payload is forbidden`
          );
        }

        // Same request → safe replay (do nothing)
        return;
      }

      throw err;
    }
  }
}
