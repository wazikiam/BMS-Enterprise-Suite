// packages/server/src/api/LedgerAccountIndex.ts

import { Pool } from 'pg';

/**
 * LedgerAccountIndex
 *
 * READ-ONLY infrastructure adapter.
 *
 * Responsibility:
 * - Discover existing ledger account + currency pairs
 * - Derived strictly from immutable ledger_entries
 *
 * Characteristics:
 * - Deterministic
 * - No writes
 * - No caching
 * - No business logic
 */
export type LedgerAccountRef = {
  accountId: string;
  currency: string;
};

export class LedgerAccountIndex {
  constructor(private readonly pool: Pool) {}

  /**
   * Returns all distinct (accountCode, currency) pairs
   * that exist in the ledger as-of now.
   *
   * NOTE:
   * - Snapshot immutability is preserved because balances
   *   are still computed with an explicit `asOf` date later.
   */
  async listAccounts(): Promise<LedgerAccountRef[]> {
    const sql = `
      SELECT DISTINCT
        payload->>'accountCode' AS "accountId",
        payload->>'currency' AS "currency"
      FROM ledger_entries
      ORDER BY "accountId", "currency"
    `;

    const res = await this.pool.query(sql);

    return res.rows.map((row) => ({
      accountId: row.accountId,
      currency: row.currency,
    }));
  }
}
