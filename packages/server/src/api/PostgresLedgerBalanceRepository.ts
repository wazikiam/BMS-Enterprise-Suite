// packages/server/src/api/PostgresLedgerBalanceRepository.ts

import { Pool } from 'pg';

import { ILedgerBalanceRepository } from '@bms/core/src/ledger-balances/LedgerBalanceRepository';
import { LedgerBalance } from '@bms/core/src/ledger-balances/LedgerBalance';
import { LedgerBalanceCalculator } from '@bms/core/src/ledger-balances/LedgerBalanceCalculator';

import { LedgerEntry } from '@bms/core/src/domain/ledger/LedgerEntry';

/**
 * PostgresLedgerBalanceRepository
 *
 * READ-ONLY adapter.
 *
 * Characteristics:
 * - Deterministic
 * - Append-only source
 * - No mutations
 * - No caching
 */
export class PostgresLedgerBalanceRepository
  implements ILedgerBalanceRepository
{
  constructor(private readonly pool: Pool) {}

  async getAccountBalance(params: {
    accountId: string;
    currency: string;
    asOf: Date;
  }): Promise<LedgerBalance> {
    const entries = await this.loadEntries({
      accountCode: params.accountId,
      currency: params.currency,
      asOf: params.asOf,
    });

    return LedgerBalanceCalculator.calculate({
      accountCode: params.accountId,
      currency: params.currency,
      asOf: params.asOf,
      entries,
    });
  }

  async getAccountBalances(params: {
    accountIds: string[];
    currency: string;
    asOf: Date;
  }): Promise<LedgerBalance[]> {
    const results: LedgerBalance[] = [];

    for (const accountId of params.accountIds) {
      results.push(
        await this.getAccountBalance({
          accountId,
          currency: params.currency,
          asOf: params.asOf,
        })
      );
    }

    return results;
  }

  /**
   * Load immutable ledger entries deterministically.
   */
  private async loadEntries(params: {
    accountCode: string;
    currency: string;
    asOf: Date;
  }): Promise<LedgerEntry[]> {
    const sql = `
      SELECT payload
      FROM ledger_entries
      WHERE
        (payload->>'accountCode') = $1
        AND (payload->>'currency') = $2
        AND occurred_at <= $3
      ORDER BY occurred_at ASC, id ASC
    `;

    const res = await this.pool.query(sql, [
      params.accountCode,
      params.currency,
      params.asOf,
    ]);

    return res.rows.map((r) => r.payload as LedgerEntry);
  }
}
