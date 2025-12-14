// packages/server/src/api/PostgresLedgerEntryRepository.ts

import { Pool } from 'pg';
import { ILedgerEntryRepository } from '@bms/core/src/repositories/LedgerEntryRepository';
import { LedgerEntry } from '@bms/core/src/domain/ledger/LedgerEntry';

/**
 * PostgreSQL adapter for ILedgerEntryRepository.
 *
 * This is a read-optimized projection.
 * Entries are treated as immutable facts.
 *
 * Actual projection mechanics are finalized later.
 */
export class PostgresLedgerEntryRepository
  implements ILedgerEntryRepository
{
  constructor(private readonly pool: Pool) {}

  async getById(entryId: string): Promise<LedgerEntry | null> {
    const sql = `
      SELECT payload
      FROM ledger_entries
      WHERE id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const res = await this.pool.query(sql, [entryId]);

    if (res.rowCount === 0) return null;

    return res.rows[0].payload as LedgerEntry;
  }

  async list(params?: {
    periodFrom?: Date;
    periodTo?: Date;
    occurredFrom?: Date;
    occurredTo?: Date;
    accountCode?: string;
    side?: 'DEBIT' | 'CREDIT';
    currency?: string;
    referenceType?: string;
    referenceId?: string;
    limit?: number;
  }): Promise<LedgerEntry[]> {
    const limit = Math.min(params?.limit ?? 100, 1000);

    const clauses: string[] = [];
    const values: any[] = [];
    let i = 1;

    if (params?.accountCode) {
      clauses.push(`payload->>'accountCode' = $${i++}`);
      values.push(params.accountCode);
    }

    if (params?.side) {
      clauses.push(`payload->>'side' = $${i++}`);
      values.push(params.side);
    }

    if (params?.currency) {
      clauses.push(`payload->>'currency' = $${i++}`);
      values.push(params.currency);
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const sql = `
      SELECT payload
      FROM ledger_entries
      ${where}
      ORDER BY occurred_at DESC, id DESC
      LIMIT $${i}
    `;

    values.push(limit);

    const res = await this.pool.query(sql, values);
    return res.rows.map((r) => r.payload as LedgerEntry);
  }
}
