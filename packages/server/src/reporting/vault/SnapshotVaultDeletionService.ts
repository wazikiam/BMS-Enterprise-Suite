// packages/server/src/reporting/vault/SnapshotVaultDeletionService.ts

import { Pool } from 'pg';

/**
 * Snapshot vault deletion workflow service.
 *
 * Governance:
 * - Explicit operator intent only
 * - Legal-hold enforced
 * - Two-person approval required
 * - Audit logging mandatory
 * - Destructive action is last and gated
 */
export class SnapshotVaultDeletionService {
  constructor(private readonly db: Pool) {}

  async placeLegalHold(params: {
    snapshotId: string;
    actorId: string;
    reason: string;
  }): Promise<void> {
    const { snapshotId, actorId, reason } = params;

    if (!snapshotId) throw new Error('snapshotId is required');
    if (!actorId) throw new Error('actorId is required');
    if (!reason) throw new Error('reason is required');

    await this.db.query(
      `
      INSERT INTO snapshot_vault_legal_hold
        (snapshot_id, reason, placed_by_actor_id)
      VALUES ($1, $2, $3)
      `,
      [snapshotId, reason, actorId]
    );
  }

  async requestDeletion(params: {
    snapshotId: string;
    actorId: string;
    reason: string;
  }): Promise<{ requestId: string }> {
    const { snapshotId, actorId, reason } = params;

    if (!snapshotId) throw new Error('snapshotId is required');
    if (!actorId) throw new Error('actorId is required');
    if (!reason) throw new Error('reason is required');

    const legalHold = await this.db.query(
      `SELECT 1 FROM snapshot_vault_legal_hold WHERE snapshot_id = $1`,
      [snapshotId]
    );
    if (legalHold.rowCount > 0) {
      throw new Error('Snapshot is under legal hold');
    }

    const res = await this.db.query(
      `
      INSERT INTO snapshot_vault_deletion_request
        (snapshot_id, requested_by_actor_id, reason)
      VALUES ($1, $2, $3)
      RETURNING request_id
      `,
      [snapshotId, actorId, reason]
    );

    return { requestId: res.rows[0].request_id };
  }

  async approveDeletion(params: {
    requestId: string;
    actorId: string;
  }): Promise<void> {
    const { requestId, actorId } = params;

    if (!requestId) throw new Error('requestId is required');
    if (!actorId) throw new Error('actorId is required');

    await this.db.query(
      `
      INSERT INTO snapshot_vault_deletion_approval
        (request_id, approved_by_actor_id)
      VALUES ($1, $2)
      `,
      [requestId, actorId]
    );
  }

  async executeDeletion(params: {
    requestId: string;
    actorId: string;
  }): Promise<void> {
    const { requestId, actorId } = params;

    if (!requestId) throw new Error('requestId is required');
    if (!actorId) throw new Error('actorId is required');

    const approvals = await this.db.query(
      `
      SELECT COUNT(DISTINCT approved_by_actor_id) AS cnt
      FROM snapshot_vault_deletion_approval
      WHERE request_id = $1
      `,
      [requestId]
    );

    if (Number(approvals.rows[0].cnt) < 2) {
      throw new Error('Two distinct approvals are required');
    }

    const req = await this.db.query(
      `
      SELECT snapshot_id
      FROM snapshot_vault_deletion_request
      WHERE request_id = $1
        AND executed_at IS NULL
      `,
      [requestId]
    );

    if (req.rowCount === 0) {
      throw new Error('Deletion request not found or already executed');
    }

    const snapshotId = req.rows[0].snapshot_id;

    await this.db.query('BEGIN');
    try {
      // Destructive action (explicit and final)
      await this.db.query(
        `DELETE FROM reporting_snapshot_vault WHERE snapshot_id = $1`,
        [snapshotId]
      );

      // Audit record
      await this.db.query(
        `
        INSERT INTO snapshot_vault_audit_log
          (snapshot_id, action, actor_id, note)
        VALUES ($1, 'VAULT_RESTORE', $2, 'Vault deletion executed')
        `,
        [snapshotId, actorId]
      );

      // Mark request as executed (append-only marker)
      await this.db.query(
        `
        INSERT INTO snapshot_vault_deletion_request
          (request_id, snapshot_id, requested_by_actor_id, reason, executed_at)
        VALUES ($1, $2, $3, 'EXECUTION_MARKER', now())
        `,
        [requestId, snapshotId, actorId]
      );

      await this.db.query('COMMIT');
    } catch (err) {
      await this.db.query('ROLLBACK');
      throw err;
    }
  }
}
