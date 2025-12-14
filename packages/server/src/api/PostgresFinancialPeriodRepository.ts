import { Pool } from 'pg';

export interface FinancialPeriodStatus {
  id: string;
  periodStart: Date;
  periodEnd: Date;
  state: string;
  createdAt: Date;
}

/**
 * Read-only repository for financial periods.
 *
 * Deterministic rules:
 * - Latest row by created_at is authoritative
 * - Multiple rows with same max(created_at) = CORRUPTION
 * - Missing period = not governed yet
 */
export class PostgresFinancialPeriodRepository {
  constructor(private readonly pool: Pool) {}

  async getLatestForPeriod(params: {
    periodFrom: Date;
    periodTo: Date;
  }): Promise<FinancialPeriodStatus | null> {
    /**
     * We first compute the max(created_at) for the period,
     * then ensure exactly ONE row exists for that timestamp.
     */
    const sql = `
      WITH latest AS (
        SELECT MAX(created_at) AS max_created_at
        FROM financial_periods
        WHERE period_start = $1
          AND period_end = $2
      )
      SELECT
        fp.id,
        fp.period_start,
        fp.period_end,
        fp.state,
        fp.created_at
      FROM financial_periods fp
      JOIN latest l
        ON fp.created_at = l.max_created_at
      WHERE fp.period_start = $1
        AND fp.period_end = $2
    `;

    const res = await this.pool.query(sql, [
      params.periodFrom,
      params.periodTo,
    ]);

    if (res.rowCount === 0) {
      // Period exists nowhere → not governed yet
      return null;
    }

    if (res.rowCount > 1) {
      // Deterministic violation → corruption
      throw new Error(
        `Ambiguous financial period state detected for ` +
          `${params.periodFrom.toISOString()} → ${params.periodTo.toISOString()}`
      );
    }

    const row = res.rows[0];

    return {
      id: row.id,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      state: row.state,
      createdAt: row.created_at,
    };
  }
}
