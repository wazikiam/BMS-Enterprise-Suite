// packages/server/src/guards/snapshotEligibility.guard.ts

import { Request } from 'express';

export type SnapshotClassification =
  | 'PERIOD_CLOSE'
  | 'MANAGEMENT_REVIEW'
  | 'AUDIT_COMPLIANCE'
  | 'INVESTIGATION';

export interface SnapshotEligibilityContext {
  classification: SnapshotClassification;
  periodStatus: 'OPEN' | 'CLOSED' | 'REPORTED';
  reports: string[];
}

export class SnapshotEligibilityGuard {
  /**
   * Enforce snapshot eligibility rules.
   * This is a hard gate. Fail closed.
   */
  static assertEligible(
    req: Request,
    ctx: SnapshotEligibilityContext
  ): void {
    // ---- Identity enforcement ----
    const actor = (req as any).actor;

    if (!actor || !actor.id || !Array.isArray(actor.roles)) {
      throw new Error('FORBIDDEN: Missing or invalid actor identity');
    }

    // ---- Classification rules ----
    switch (ctx.classification) {
      case 'PERIOD_CLOSE':
      case 'AUDIT_COMPLIANCE':
        if (ctx.periodStatus !== 'CLOSED' && ctx.periodStatus !== 'REPORTED') {
          throw new Error(
            `INVALID_SNAPSHOT: ${ctx.classification} requires CLOSED or REPORTED period`
          );
        }
        break;

      case 'MANAGEMENT_REVIEW':
        // Period may be OPEN
        break;

      case 'INVESTIGATION':
        // Explicitly non-final
        break;

      default:
        throw new Error('INVALID_SNAPSHOT: Unknown classification');
    }

    // ---- Report eligibility enforcement ----
    for (const report of ctx.reports) {
      if (SnapshotEligibilityGuard.isLiveOnlyReport(report)) {
        throw new Error(
          `INVALID_SNAPSHOT: Report '${report}' is live-only and cannot be snapshotted`
        );
      }
    }
  }

  /**
   * Central list of live-only reports.
   * This must remain explicit and conservative.
   */
  private static isLiveOnlyReport(reportId: string): boolean {
    const LIVE_ONLY_REPORTS = [
      'REALTIME_ACTIVITY',
      'TODAYS_SALES',
      'LIVE_PAYMENTS',
      'USER_DASHBOARD',
    ];

    return LIVE_ONLY_REPORTS.includes(reportId);
  }
}
