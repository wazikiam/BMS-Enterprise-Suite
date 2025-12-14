// packages/server/src/api/PostgresLedgerPostingRepository.ts

/**
 * POSTGRES LEDGER POSTING REPOSITORY
 *
 * ROLE:
 * - Infrastructure-only adapter
 * - Append-only persistence of immutable ledger postings
 *
 * GUARANTEES:
 * - NO updates
 * - NO deletes
 * - Deterministic ordering
 * - Idempotent behavior on duplicate IDs
 *
 * DATABASE ASSUMPTIONS:
 * - ledger_postings.id is PRIMARY KEY
 * - ledger_postings is append-only
 */

import { Pool } from 'pg';
import { ILedgerPostingRepository } from '@bms/core/src/repositories/LedgerPostingRepository';
import { LedgerPosting } from '@bms/core/src/domain/ledger/LedgerPosting';

export class PostgresLedgerPostingRepository
  implements ILedgerPostingRepository
{
  constructor(private readonly pool: Pool) {
    if (!pool) {
      throw new Error(
        'PostgresLedgerPostingRepository requires a database pool'
      );
    }
  }

  /**
   * Append a new immutable ledger posting.
   *
   * IDEMPOTENCY RULE:
   * - If the same posting ID is inserted twice, the second insert is ignored
   * - History is never mutated
   * - Caller receives success (idempotent write)
   */
  async append(posting: LedgerPosting): Promise<void> {
    const sql = `
      INSERT INTO ledger_postings (
        id,
        occurred_at,
        payload,
        created_at
      )
      VALUES ($1, $2, $3::jsonb, now())
      ON CONFLICT (id) DO NOTHING
    `;

    await this.pool.query(sql, [
      posting.id,
      posting.occurredAt,
      JSON.stringify(posting),
    ]);
  }

  /**
   * Retrieve a posting by its unique ID.
   *
   * Deterministic:
   * - If multiple rows somehow exist (should not happen),
   *   the most recent is returned explicitly.
   */
  async getById(postingId: string): Promise<LedgerPosting | null> {
    const sql = `
      SELECT payload
      FROM ledger_postings
      WHERE id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const res = await this.pool.query(sql, [postingId]);

    if (res.rowCount === 0) {
      return null;
    }

    return res.rows[0].payload as LedgerPosting;
  }

  /**
   * Deterministic listing of postings.
   *
   * DEFAULT ORDER:
   * - occurred_at DESC
   * - id DESC
   */
  async list(params?: {
    periodFrom?: Date;
    periodTo?: Date;
    occurredFrom?: Date;
    occurredTo?: Date;
    referenceType?: string;
    referenceId?: string;
    limit?: number;
  }): Promise<LedgerPosting[]> {
    const limit = Math.min(params?.limit ?? 50, 500);

    const clauses: string[] = [];
    const values: any[] = [];
    let i = 1;

    if (params?.occurredFrom) {
      clauses.push(`occurred_at >= $${i++}`);
      values.push(params.occurredFrom);
    }

    if (params?.occurredTo) {
      clauses.push(`occurred_at <= $${i++}`);
      values.push(params.occurredTo);
    }

    const where = clauses.length > 0
      ? `WHERE ${clauses.join(' AND ')}`
      : '';

    const sql = `
      SELECT payload
      FROM ledger_postings
      ${where}
      ORDER BY occurred_at DESC, id DESC
      LIMIT $${i}
    `;

    values.push(limit);

    const res = await this.pool.query(sql, values);
    return res.rows.map((r) => r.payload as LedgerPosting);
  }
}
