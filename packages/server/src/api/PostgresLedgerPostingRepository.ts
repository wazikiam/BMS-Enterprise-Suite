// packages/server/src/api/PostgresLedgerPostingRepository.ts

import { Pool } from 'pg';
import { ILedgerPostingRepository } from '@bms/core/src/repositories/LedgerPostingRepository';
import { LedgerPosting } from '@bms/core/src/domain/ledger/LedgerPosting';

/**
 * PostgreSQL adapter for ILedgerPostingRepository.
 *
 * This adapter is:
 * - Append-only
 * - Deterministic
 * - Infrastructure-only
 *
 * It assumes postings are persisted as immutable facts.
 * Schema design is finalized later (DDL step).
 */
export class PostgresLedgerPostingRepository
  implements ILedgerPostingRepository
{
  constructor(private readonly pool: Pool) {}

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
