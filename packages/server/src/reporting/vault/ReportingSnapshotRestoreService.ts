// packages/server/src/reporting/vault/ReportingSnapshotRestoreService.ts

import { Pool } from 'pg';
import crypto from 'crypto';

/**
 * Explicit restore/apply of a snapshot payload from the vault
 * back into the runtime snapshot store.
 *
 * Governance:
 * - Manual only
 * - Non-destructive to vault
 * - Audit logging is mandatory
 */
export class ReportingSnapshotRestoreService {
  constructor(
    private readonly db: Pool,
    private readonly runtimeSnapshotStore: {
      setPayload(snapshotId: string, payload: unknown): Promise<void>;
      hasPayload(snapshotId: string): Promise<boolean>;
    }
  ) {}

  /**
   * Restore a vaulted snapshot payload into the runtime store.
   */
  async restoreFromVault(params: {
    snapshotId: string;
    actorId: string;
    expectedPayloadHash?: string;
  }): Promise<{ restored: true }> {
    const { snapshotId, actorId, expectedPayloadHash } = params;

    if (!snapshotId) {
      throw new Error('snapshotId is required');
    }
    if (!actorId) {
      throw new Error('actorId is required');
    }

    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      /* 1) Load latest vault record */
      const vaultResult = await client.query(
        `
        SELECT
          snapshot_id,
          storage_format,
          payload_json,
          payload_jsonb,
          payload_hash
        FROM reporting_snapshot_vault
        WHERE snapshot_id = $1
        ORDER BY vaulted_at DESC
        LIMIT 1
        `,
        [snapshotId]
      );

      if (vaultResult.rowCount === 0) {
        throw new Error(
          `No vault record found for snapshot ${snapshotId}`
        );
      }

      const record = vaultResult.rows[0];

      /* 2) Extract payload */
      const payload =
        record.storage_format === 'jsonb'
          ? record.payload_jsonb
          : record.payload_json;

      if (!payload) {
        throw new Error(
          `Vault record payload is empty for snapshot ${snapshotId}`
        );
      }

      /* 3) Verify integrity */
      const serialized = JSON.stringify(payload);
      const actualHash = crypto
        .createHash('sha256')
        .update(serialized)
        .digest('hex');

      if (actualHash !== record.payload_hash) {
        throw new Error(
          `Vault payload hash mismatch for snapshot ${snapshotId}`
        );
      }

      if (
        expectedPayloadHash &&
        expectedPayloadHash !== actualHash
      ) {
        throw new Error(
          `Expected payload hash does not match vault payload for snapshot ${snapshotId}`
        );
      }

      /* 4) Restore into runtime store */
      await this.runtimeSnapshotStore.setPayload(snapshotId, payload);

      /* 5) Write audit log (MANDATORY) */
      await client.query(
        `
        INSERT INTO snapshot_vault_audit_log (
          snapshot_id,
          action,
          actor_id,
          reference_hash,
          note
        )
        VALUES ($1, 'VAULT_RESTORE', $2, $3, '')
        `,
        [snapshotId, actorId, actualHash]
      );

      await client.query('COMMIT');

      return { restored: true };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
