// packages/server/src/api/PostgresTrialBalanceRepository.ts
// POSTGRES TRIAL BALANCE REPOSITORY (READ-ONLY)
// - Deterministic aggregation from public.ledger_events
// - Period-aware (occurred_at)
// - As-of aware (recorded_at)
// - Currency-isolated
// - Numeric-safe: ALL arithmetic done in PostgreSQL
// - No caching, no persistence of derived state

import {
  TrialBalanceAccountLine,
  TrialBalanceQuery,
} from '@bms/core/src/ledger/TrialBalance';

export interface SqlClient {
  query<T = any>(text: string, params?: any[]): Promise<{ rows: T[] }>;
}

type TrialBalanceRow = {
  account_code: string;
  debit: string;
  credit: string;
  balance: string;
};

export class PostgresTrialBalanceRepository {
  constructor(private readonly db: SqlClient) {}

  async getAccountLines(
    query: TrialBalanceQuery
  ): Promise<TrialBalanceAccountLine[]> {
    // Strict boundary validation (fail fast, deterministic)
    if (!query.currency || typeof query.currency !== 'string') {
      throw new Error('currency is required');
    }
    if (!(query.periodFrom instanceof Date) || Number.isNaN(query.periodFrom.getTime())) {
      throw new Error('periodFrom must be a valid Date');
    }
    if (!(query.periodTo instanceof Date) || Number.isNaN(query.periodTo.getTime())) {
      throw new Error('periodTo must be a valid Date');
    }
    if (!(query.asOf instanceof Date) || Number.isNaN(query.asOf.getTime())) {
      throw new Error('asOf must be a valid Date');
    }
    if (query.periodFrom.getTime() > query.periodTo.getTime()) {
      throw new Error('periodFrom must be <= periodTo');
    }

    const sql = `
      SELECT
        account_code,
        COALESCE(SUM(debit_amount), 0)::text  AS debit,
        COALESCE(SUM(credit_amount), 0)::text AS credit,
        (COALESCE(SUM(debit_amount), 0) - COALESCE(SUM(credit_amount), 0))::text AS balance
      FROM public.ledger_events
      WHERE currency = $1
        AND occurred_at >= $2
        AND occurred_at <= $3
        AND recorded_at <= $4
        AND account_code IS NOT NULL
      GROUP BY account_code
      ORDER BY account_code ASC;
    `;

    const params = [
      query.currency,
      query.periodFrom.toISOString(),
      query.periodTo.toISOString(),
      query.asOf.toISOString(),
    ];

    const result = await this.db.query<TrialBalanceRow>(sql, params);

    return result.rows.map((r) => ({
      accountCode: r.account_code,
      debit: r.debit,
      credit: r.credit,
      balance: r.balance,
    }));
  }
}
