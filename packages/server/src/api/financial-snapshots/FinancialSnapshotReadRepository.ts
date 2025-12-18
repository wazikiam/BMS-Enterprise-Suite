// packages/server/src/api/financial-snapshots/FinancialSnapshotReadRepository.ts
// FINANCIAL SNAPSHOT READ REPOSITORY (READ-ONLY)
//
// Rules:
// - SELECT only
// - No mutations
// - Deterministic ordering
// - Snapshot data is authoritative (never recomputed)
//
// Source of truth:
// table: financial_trial_balance_snapshots

import { Pool } from 'pg';

export type FinancialTrialBalanceSnapshotRecord = {
  snapshotId: string;
  kind: string;
  periodId: string;
  periodFrom: Date;
  periodTo: Date;
  asOf: Date;
  currency: string;
  balances: unknown[];
  createdAt: Date;
};

export class FinancialSnapshotReadRepository {
  constructor(private readonly pool: Pool) {}

  /**
   * List all financial trial balance snapshots.
   * Ordered by creation time (ASC).
   */
  async listAll(): Promise<FinancialTrialBalanceSnapshotRecord[]> {
    const result = await this.pool.query(`
      SELECT
        snapshot_id      AS "snapshotId",
        kind,
        period_id        AS "periodId",
        period_from      AS "periodFrom",
        period_to        AS "periodTo",
        as_of            AS "asOf",
        currency,
        balances,
        created_at       AS "createdAt"
      FROM financial_trial_balance_snapshots
      ORDER BY created_at ASC
    `);

    return result.rows;
  }

  /**
   * Fetch a snapshot by its immutable snapshot_id.
   */
  async getById(
    snapshotId: string
  ): Promise<FinancialTrialBalanceSnapshotRecord | null> {
    const result = await this.pool.query(
      `
      SELECT
        snapshot_id      AS "snapshotId",
        kind,
        period_id        AS "periodId",
        period_from      AS "periodFrom",
        period_to        AS "periodTo",
        as_of            AS "asOf",
        currency,
        balances,
        created_at       AS "createdAt"
      FROM financial_trial_balance_snapshots
      WHERE snapshot_id = $1
      `,
      [snapshotId]
    );

    return result.rows[0] ?? null;
  }
}
