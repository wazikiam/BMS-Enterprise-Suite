// packages/server/src/guards/exportTruth.guard.ts

import { Request } from 'express';

export type ExportTruthMode =
  | 'LIVE_DATA'
  | 'SNAPSHOT_APPROVED';

export interface ExportTruthContext {
  truthMode: ExportTruthMode;
  snapshotId?: string;
  sealedHash?: string;
  runtimePayloadAvailable: boolean;
}

/**
 * ExportTruthGuard
 *
 * Enforces export truth rules:
 * - Every export declares truth mode
 * - Snapshot exports require runtime payload availability
 * - Missing authority fails closed
 */
export class ExportTruthGuard {
  static assertExportAllowed(
    req: Request,
    ctx: ExportTruthContext
  ): void {
    // ---- Identity enforcement ----
    const actor = (req as any).actor;

    if (!actor || !actor.id || !Array.isArray(actor.roles)) {
      throw new Error('FORBIDDEN: Missing or invalid actor identity');
    }

    // ---- Truth mode enforcement ----
    if (!ctx.truthMode) {
      throw new Error('INVALID_EXPORT: truth mode must be declared');
    }

    if (ctx.truthMode === 'LIVE_DATA') {
      // Live data exports are allowed but must be explicit
      return;
    }

    if (ctx.truthMode === 'SNAPSHOT_APPROVED') {
      if (!ctx.snapshotId || typeof ctx.snapshotId !== 'string') {
        throw new Error('INVALID_EXPORT: snapshotId is required for snapshot exports');
      }

      if (!ctx.sealedHash || typeof ctx.sealedHash !== 'string') {
        throw new Error('INVALID_EXPORT: sealedHash is required for snapshot exports');
      }

      if (!ctx.runtimePayloadAvailable) {
        throw new Error(
          'SNAPSHOT_NOT_AVAILABLE: approved snapshot payload is not available for export'
        );
      }

      return;
    }

    // Defensive default
    throw new Error('INVALID_EXPORT: unsupported truth mode');
  }
}
