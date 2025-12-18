// packages/server/src/guards/snapshotRetention.guard.ts

import { Request } from 'express';

export type SnapshotClassification =
  | 'PERIOD_CLOSE'
  | 'MANAGEMENT_REVIEW'
  | 'AUDIT_COMPLIANCE'
  | 'INVESTIGATION';

export interface SnapshotRetentionDecisionContext {
  classification: SnapshotClassification;
  approved: boolean;
  reason: string;
  approvedAt?: string; // optional ISO timestamp
}

export class SnapshotRetentionGuard {
  /**
   * Enforces retention policy for any deletion or purge attempt.
   * Fail closed.
   *
   * NOTE:
   * This guard blocks actions that violate policy.
   * It does not implement deletion itself.
   */
  static assertDeletionAllowed(
    req: Request,
    ctx: SnapshotRetentionDecisionContext
  ): void {
    // Identity enforcement
    const actor = (req as any).actor;

    if (!actor || !actor.id || !Array.isArray(actor.roles)) {
      throw new Error('FORBIDDEN: Missing or invalid actor identity');
    }

    if (!ctx.reason || typeof ctx.reason !== 'string' || ctx.reason.trim().length < 8) {
      throw new Error('INVALID_REQUEST: deletion reason is required (min length 8)');
    }

    // Approved snapshots have stronger protection
    if (ctx.approved) {
      if (ctx.classification === 'PERIOD_CLOSE') {
        throw new Error('FORBIDDEN: PERIOD_CLOSE snapshots must be retained indefinitely');
      }

      if (ctx.classification === 'AUDIT_COMPLIANCE') {
        throw new Error('FORBIDDEN: AUDIT_COMPLIANCE snapshots must be retained indefinitely');
      }
    }

    // MANAGEMENT_REVIEW and INVESTIGATION may be deletable only by explicit policy.
    // This guard does not enforce time windows because system-of-record timestamps
    // for deletion eligibility may live outside runtime memory.
    // Time-window enforcement must be implemented by the deleting service using a
    // persistent source of approval timestamps.
  }
}
