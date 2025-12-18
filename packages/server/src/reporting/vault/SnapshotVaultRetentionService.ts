// packages/server/src/reporting/vault/SnapshotVaultRetentionService.ts

import { Pool } from 'pg';

export type RetentionMode = 'INDEFINITE' | 'AGE_DAYS';

export interface RetentionPolicy {
  policyId: string;
  name: string;
  retentionMode: RetentionMode;
  ageDays: number | null;
  setByActorId: string;
  setAt: Date;
  note: string;
}

export interface RetentionDryRunResult {
  snapshotId: string;
  vaultedAt: Date;
  ageDays: number;
}

/**
 * Retention policy service.
 * Explicit configuration only.
 * NO deletion capability exists here.
 */
export class SnapshotVaultRetentionService {
  constructor(private readonly db: Pool) {}

  async setPolicy(params: {
    name: string;
    retentionMode: RetentionMode;
    ageDays?: number;
    actorId: string;
    note?: string;
  }): Promise<{ policyId: string }> {
    const { name, retentionMode, ageDays, actorId, note } = params;

    if (!name) throw new Error('name is required');
    if (!actorId) throw new Error('actorId is required');

    if (retentionMode === 'AGE_DAYS' && !ageDays) {
      throw new Error('ageDays is required for AGE_DAYS retention mode');
    }

    const result = await this.db.query(
      `
      INSERT INTO snapshot_vault_retention_policy (
        name,
        retention_mode,
        age_days,
        set_by_actor_id,
        note
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING policy_id
      `,
      [name, retentionMode, ageDays ?? null, actorId, note ?? '']
    );

    return { policyId: result.rows[0].policy_id };
  }

  async getLatestPolicy(name: string): Promise<RetentionPolicy | null> {
    const result = await this.db.query(
      `
      SELECT
        policy_id,
        name,
        retention_mode,
        age_days,
        set_by_actor_id,
        set_at,
        note
      FROM snapshot_vault_retention_policy
      WHERE name = $1
      ORDER BY set_at DESC
      LIMIT 1
      `,
      [name]
    );

    if (result.rowCount === 0) return null;

    const r = result.rows[0];
    return {
      policyId: r.policy_id,
      name: r.name,
      retentionMode: r.retention_mode,
      ageDays: r.age_days,
      setByActorId: r.set_by_actor_id,
      setAt: r.set_at,
      note: r.note,
    };
  }

  /**
   * Dry-run only: shows which vault records would be eligible
   * under the latest policy.
   */
  async dryRunEligibleVaultEntries(params: {
    policyName: string;
    now: Date;
  }): Promise<RetentionDryRunResult[]> {
    const policy = await this.getLatestPolicy(params.policyName);
    if (!policy) {
      throw new Error(`No retention policy found for name: ${params.policyName}`);
    }

    if (policy.retentionMode === 'INDEFINITE') {
      return [];
    }

    const result = await this.db.query(
      `
      SELECT
        snapshot_id,
        vaulted_at,
        EXTRACT(DAY FROM ($1::timestamptz - vaulted_at))::int AS age_days
      FROM reporting_snapshot_vault
      WHERE vaulted_at < ($1::timestamptz - ($2 || ' days')::interval)
      ORDER BY vaulted_at ASC
      `,
      [params.now, policy.ageDays]
    );

    return result.rows.map((r) => ({
      snapshotId: r.snapshot_id,
      vaultedAt: r.vaulted_at,
      ageDays: r.age_days,
    }));
  }
}
