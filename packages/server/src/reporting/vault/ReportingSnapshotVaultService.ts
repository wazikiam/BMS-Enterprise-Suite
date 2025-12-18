// packages/server/src/reporting/vault/ReportingSnapshotVaultService.ts

import { Pool } from 'pg';
import crypto from 'crypto';

/**
 * Explicit, governed export of a runtime snapshot payload into the vault.
 * This service MUST be called manually and intentionally.
 *
 * Governance rules:
 * - No auto-trigger
 * - No auto-restore
 * - No payload synthesis
 * - Fail closed if runtime payload is missing
 * - Audit logging is mandatory
 */
export class ReportingSnapshotVaultService {
  constructor(
    private readonly db: Pool,
    private readonly runtimeSnapshotStore: {
      getPayload(snapshotId: string): Promise<unknown | null>;
    }
  ) {}

  /**
   * Export an APPROVED snapshot's runtime payload into the vault.
   * Append-only. Irreversible.
   */
  async exportToVault(params: {
    snapshotId: string;
    actorId: string;
    note?: string;
  }): Promise<{ vaultId: string }> {
    const { snapshotId, actorId, note } = params;

    if (!snapshotId) {
      throw new Error('snapshotId is required');
    }
    if (!actorId) {
      throw new Error('actorId is required');
    }

    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      /* 1) Verify snapshot exists and is approved */
      const snapshotResult = await client.query(
        `
        SELECT snapshot_id, approved_at
        FROM reporting_snapshots
        WHERE snapshot_id = $1
        FOR UPDATE
        `,
        [snapshotId]
      );

      if (snapshotResult.rowCount === 0) {
        throw new Error(`Snapshot not found: ${snapshotId}`);
      }

      if (!snapshotResult.rows[0].approved_at) {
        throw new Error(`Snapshot is not approved: ${snapshotId}`);
      }

      /* 2) Load runtime payload (must exist) */
      const payload = await this.runtimeSnapshotStore.getPayload(snapshotId);
      if (!payload) {
        throw new Error(
          `Runtime snapshot payload not available for snapshot ${snapshotId}`
        );
      }

      /* 3) Canonicalize payload */
      const serialized = JSON.stringify(payload);
      const sizeBytes = Buffer.byteLength(serialized, 'utf8');

      /* 4) Compute vault integrity hash */
      const payloadHash = crypto
        .createHash('sha256')
        .update(serialized)
        .digest('hex');

      /* 5) Persist to vault */
      const vaultInsert = await client.query(
        `
        INSERT INTO reporting_snapshot_vault (
          snapshot_id,
          storage_format,
          payload_jsonb,
          payload_hash,
          size_bytes,
          vaulted_by_actor_id,
          note
        )
        VALUES ($1, 'jsonb', $2::jsonb, $3, $4, $5, $6)
        RETURNING vault_id
        `,
        [
          snapshotId,
          serialized,
          payloadHash,
          sizeBytes,
          actorId,
          note ?? '',
        ]
      );

      const vaultId = vaultInsert.rows[0].vault_id;

      /* 6) Write audit log (MANDATORY) */
      await client.query(
        `
        INSERT INTO snapshot_vault_audit_log (
          snapshot_id,
          action,
          actor_id,
          reference_hash,
          note
        )
        VALUES ($1, 'VAULT_EXPORT', $2, $3, $4)
        `,
        [snapshotId, actorId, payloadHash, note ?? '']
      );

      await client.query('COMMIT');

      return { vaultId };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
