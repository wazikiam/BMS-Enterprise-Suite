// packages/server/src/services/TrialBalanceReadService.ts
// TRIAL BALANCE — INFRASTRUCTURE IMPLEMENTATION
//
// Deterministic, read-only, append-only compliant
// Derived exclusively from ledger_entries
// Fails closed on infrastructure errors

import { Pool } from 'pg';
import {
  TrialBalanceReadService,
  TrialBalanceQuery,
  TrialBalanceResult,
  TrialBalanceAccountLine
} from '@bms/core/src/ledger/TrialBalance';

export class PostgresTrialBalanceReadService
  implements TrialBalanceReadService
{
  constructor(private readonly pool: Pool) {}

  async getTrialBalance(
    query: TrialBalanceQuery
  ): Promise<TrialBalanceResult> {
    const { periodFrom, periodTo, asOf, currency } = query;

    const sql = `
      SELECT
        account_code,
        SUM(CASE WHEN side = 'DEBIT' THEN amount ELSE 0 END) AS debit,
        SUM(CASE WHEN side = 'CREDIT' THEN amount ELSE 0 END) AS credit
      FROM ledger_entries
      WHERE
        occurred_at >= $1
        AND occurred_at <= $2
        AND created_at <= $3
        AND currency = $4
      GROUP BY account_code
      ORDER BY account_code ASC
    `;

    try {
      const result = await this.pool.query(sql, [
        periodFrom,
        periodTo,
        asOf,
        currency
      ]);

      const accounts: TrialBalanceAccountLine[] = result.rows.map(
        (row) => {
          const debit = row.debit ?? '0';
          const credit = row.credit ?? '0';

          return {
            accountCode: row.account_code,
            debit: String(debit),
            credit: String(credit),
            balance: String(Number(debit) - Number(credit))
          };
        }
      );

      return {
        period: {
          from: periodFrom,
          to: periodTo,
          asOf
        },
        currency,
        accounts
      };
    } catch {
      // Fail closed: never return partial or misleading financial data
      throw new Error(
        'Trial Balance query failed due to infrastructure error'
      );
    }
  }
}
