// packages/server/src/api/reporting-snapshots/storeSealedSnapshot.controller.ts

import { Request, Response } from 'express';
import crypto from 'crypto';

import {
  ReportingSnapshotVault,
  ReportingSnapshotVaultBundleV1,
} from '@bms/core/src/reporting-snapshots/vault/ReportingSnapshotVault';

/**
 * StoreSealedSnapshotController
 *
 * This endpoint is called explicitly by the UI AFTER governance sealing.
 *
 * SECURITY:
 * - Requires SNAPSHOT_VAULT_WRITER role
 * - Enforces cryptographic integrity
 * - Write-once, immutable audit storage
 *
 * The backend does NOT decide governance.
 * It enforces authority and integrity only.
 */
export class StoreSealedSnapshotController {
  constructor(private readonly vault: ReportingSnapshotVault) {}

  async store(req: Request, res: Response): Promise<void> {
    /**
     * Actor identity MUST be injected by auth middleware.
     */
    const actor = (req as any).actor;
    if (!actor || !Array.isArray(actor.roles)) {
      res.status(403).json({ error: 'vault write not authorized' });
      return;
    }

    if (!actor.roles.includes('SNAPSHOT_VAULT_WRITER')) {
      res.status(403).json({ error: 'SNAPSHOT_VAULT_WRITER role required' });
      return;
    }

    const body = req.body ?? {};

    const snapshotId = body.snapshotId;
    const version = body.version;
    const period = body.period;
    const asOf = body.asOf;
    const sealedAt = body.sealedAt;
    const sealedHash = body.sealedHash;
    const payload = body.payload;

    if (!snapshotId || typeof snapshotId !== 'string') {
      res.status(400).json({ error: 'snapshotId is required' });
      return;
    }

    if (typeof version !== 'number' || !Number.isFinite(version) || version < 1) {
      res.status(400).json({ error: 'version is required (number >= 1)' });
      return;
    }

    if (
      !period ||
      typeof period !== 'object' ||
      typeof period.from !== 'string' ||
      typeof period.to !== 'string'
    ) {
      res.status(400).json({ error: 'period {from,to} is required (ISO strings)' });
      return;
    }

    if (!asOf || typeof asOf !== 'string') {
      res.status(400).json({ error: 'asOf is required (ISO string)' });
      return;
    }

    if (!sealedAt || typeof sealedAt !== 'string') {
      res.status(400).json({ error: 'sealedAt is required (ISO string)' });
      return;
    }

    if (!sealedHash || typeof sealedHash !== 'string' || sealedHash.length < 16) {
      res.status(400).json({ error: 'sealedHash is required' });
      return;
    }

    if (payload === undefined) {
      res.status(400).json({ error: 'payload is required' });
      return;
    }

    /**
     * Cryptographic integrity enforcement
     */
    const canonicalPayload = JSON.stringify(payload);
    const computedHash = crypto
      .createHash('sha256')
      .update(canonicalPayload)
      .digest('hex');

    if (computedHash !== sealedHash) {
      res.status(409).json({
        error: 'sealedHash mismatch',
        expected: sealedHash,
        computed: computedHash,
      });
      return;
    }

    const bundle: ReportingSnapshotVaultBundleV1 = {
      kind: 'SEALED_SNAPSHOT_BUNDLE_V1',
      snapshotId,
      version,
      period: {
        from: period.from,
        to: period.to,
      },
      asOf,
      sealedAt,
      sealedHash,
      payload,
    };

    await this.vault.storeSealedBundle(bundle);

    res.status(201).json({
      status: 'VAULT_STORED',
      snapshotId,
      sealedHash,
    });
  }
}
