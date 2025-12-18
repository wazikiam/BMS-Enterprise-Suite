// packages/server/src/reporting/vault/SnapshotVaultAuditReadService.ts

import { Pool } from 'pg';

export interface SnapshotVaultAuditRecord {
  auditId: string;
  snapshotId: string;
  action: 'VAULT_EXPORT' | 'VAULT_RESTORE';
  actorId: string;
  referenceHash: string | null;
  note: string;
  occurredAt: Date;
}

/**
 * Read-only audit log access.
 * No mutation methods exist here.
 */
export class SnapshotVaultAuditReadService {
  constructor(private readonly db: Pool) {}

  async listBySnapshot(params: {
    snapshotId: string;
    limit: number;
    offset: number;
  }): Promise<SnapshotVaultAuditRecord[]> {
    const { snapshotId, limit, offset } = params;

    if (!snapshotId) {
      throw new Error('snapshotId is required');
    }

    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const safeOffset = Math.max(offset, 0);

    const result = await this.db.query(
      `
      SELECT
        audit_id,
        snapshot_id,
        action,
        actor_id,
        reference_hash,
        note,
        occurred_at
      FROM snapshot_vault_audit_log
      WHERE snapshot_id = $1
      ORDER BY occurred_at DESC
      LIMIT $2 OFFSET $3
      `,
      [snapshotId, safeLimit, safeOffset]
    );

    return result.rows.map((r) => ({
      auditId: r.audit_id,
      snapshotId: r.snapshot_id,
      action: r.action,
      actorId: r.actor_id,
      referenceHash: r.reference_hash,
      note: r.note,
      occurredAt: r.occurred_at,
    }));
  }
}
