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
 * - Append-only table
 * - Latest row per period = authoritative state
 * - NO mutation methods by design
 */
export class PostgresFinancialPeriodRepository {
  constructor(private readonly pool: Pool) {}

  /**
   * Returns the latest state of a financial period
   * matching the given date range.
   */
  async getLatestForPeriod(params: {
    periodFrom: Date;
    periodTo: Date;
  }): Promise<FinancialPeriodStatus | null> {
    const sql = `
      SELECT
        id,
        period_start,
        period_end,
        state,
        created_at
      FROM financial_periods
      WHERE period_start = $1
        AND period_end = $2
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const res = await this.pool.query(sql, [
      params.periodFrom,
      params.periodTo,
    ]);

    if (res.rowCount === 0) {
      return null;
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
