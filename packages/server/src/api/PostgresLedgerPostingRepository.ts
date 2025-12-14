// packages/server/src/api/PostgresLedgerPostingRepository.ts

/**
 * INFRASTRUCTURE-ONLY MODULE
 *
 * This file is an infrastructure adapter.
 *
 * RULES:
 * - MUST NOT be imported by packages/core
 * - MUST NOT contain domain logic
 * - MUST NOT enforce business rules
 * - Persistence only (append-only)
 *
 * If this file is ever imported outside packages/server,
 * that is an architectural violation.
 */

import { Pool } from 'pg';
import { ILedgerPostingRepository } from '@bms/core/src/repositories/LedgerPostingRepository';
import { LedgerPosting } from '@bms/core/src/domain/ledger/LedgerPosting';

/**
 * PostgreSQL adapter for ILedgerPostingRepository.
 *
 * Characteristics:
 * - Append-only
 * - Deterministic
 * - No updates
 * - No deletes
 * - No business rules
 *
 * This class is INFRASTRUCTURE.
 */
export class PostgresLedgerPostingRepository
  implements ILedgerPostingRepository
{
  constructor(private readonly pool: Pool) {
    // Defensive runtime guard: this should never execute outside server
    if (!pool) {
      throw new Error(
        'PostgresLedgerPostingRepository requires a PostgreSQL pool (infrastructure context)'
      );
    }
  }

  /**
   * Append a new immutable ledger posting.
   *
   * This method:
   * - Assumes all invariants are already enforced upstream
   * - Performs NO validation
   * - Writes facts only
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
    `;

    await this.pool.query(sql, [
      posting.id,
      posting.occurredAt,
      JSON.stringify(posting),
    ]);
  }

  /**
   * Retrieve a posting by id.
   *
   * Deterministic:
   * - ORDER BY created_at DESC
   * - LIMIT 1
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

    if (res.rowCount === 0) return null;

    return res.rows[0].payload as LedgerPosting;
  }

  /**
   * Deterministic listing of postings.
   *
   * Ordering:
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

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

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
