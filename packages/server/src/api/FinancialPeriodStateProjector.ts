// packages/server/src/api/FinancialPeriodStateProjector.ts
// FINANCIAL PERIOD STATE PROJECTOR (CANONICAL)
//
// Deterministic, side-effect free read model projection.
// Interprets ONLY canonical finance event types emitted by core:
//
// - PERIOD_CREATED
// - PERIOD_CLOSED
// - PERIOD_REOPENED
// - LEGAL_HOLD_SET
// - LEGAL_HOLD_CLEARED
//
// Unknown events are tolerated (ignored).
//
// Output is used by:
// - GET /api/finance/periods
// - FinancialPeriodGate (ledger write hard-gate)

import {
  FinancialPeriodEventTypes,
  FinancialPeriodEventType,
} from '@bms/core/src/finance/FinancialPeriodEventTypes';

export type FinancialPeriodStatus = 'OPEN' | 'CLOSED' | 'LOCKED';

export type FinancialPeriodState = {
  periodId: string;
  periodFrom: Date;
  periodTo: Date;
  label: string;

  // Governance outputs
  status: FinancialPeriodStatus;
  legalHold: boolean;

  // Convenience flags (backwards-safe)
  closed: boolean;
};

export type FinancialPeriodEventLike = {
  periodId: string;
  eventType: string;

  periodFrom?: Date;
  periodTo?: Date;
  label?: string;

  recordedAt?: Date;
};

function asDate(d: unknown): Date | null {
  if (d instanceof Date && !Number.isNaN(d.getTime())) return d;
  return null;
}

export class FinancialPeriodStateProjector {
  /**
   * Pure projector.
   * Input must be a single period stream (all same periodId).
   */
  static project(events: FinancialPeriodEventLike[]): FinancialPeriodState {
    if (!events || events.length === 0) {
      throw new Error('No events to project financial period state');
    }

    // Deterministic ordering: recordedAt ASC if provided, otherwise stable input order.
    const sorted = [...events].sort((a, b) => {
      const at = a.recordedAt ? a.recordedAt.getTime() : 0;
      const bt = b.recordedAt ? b.recordedAt.getTime() : 0;
      return at - bt;
    });

    const periodId = sorted[0].periodId;

    let periodFrom: Date | null = null;
    let periodTo: Date | null = null;
    let label: string | null = null;

    let isClosed = false;
    let legalHold = false;

    for (const ev of sorted) {
      // Enforce single stream
      if (ev.periodId !== periodId) {
        throw new Error('Mixed periodId event stream passed to projector');
      }

      const t = ev.eventType as FinancialPeriodEventType;

      switch (t) {
        case FinancialPeriodEventTypes.PERIOD_CREATED: {
          const pf = asDate(ev.periodFrom);
          const pt = asDate(ev.periodTo);

          if (!pf || !pt) {
            throw new Error('PERIOD_CREATED missing periodFrom/periodTo');
          }
          if (pf.getTime() > pt.getTime()) {
            throw new Error('PERIOD_CREATED invalid range: periodFrom > periodTo');
          }

          if (!ev.label || String(ev.label).trim() === '') {
            throw new Error('PERIOD_CREATED missing label');
          }

          periodFrom = pf;
          periodTo = pt;
          label = ev.label;

          // Created implies open (initial)
          isClosed = false;
          break;
        }

        case FinancialPeriodEventTypes.PERIOD_CLOSED:
          isClosed = true;
          break;

        case FinancialPeriodEventTypes.PERIOD_REOPENED:
          isClosed = false;
          break;

        case FinancialPeriodEventTypes.LEGAL_HOLD_SET:
          legalHold = true;
          break;

        case FinancialPeriodEventTypes.LEGAL_HOLD_CLEARED:
          legalHold = false;
          break;

        default:
          // Unknown events tolerated (ignored)
          break;
      }
    }

    if (!periodFrom || !periodTo || !label) {
      throw new Error('Incomplete financial period state (missing PERIOD_CREATED)');
    }

    const status: FinancialPeriodStatus = legalHold
      ? 'LOCKED'
      : isClosed
      ? 'CLOSED'
      : 'OPEN';

    return {
      periodId,
      periodFrom,
      periodTo,
      label,
      status,
      legalHold,
      closed: status !== 'OPEN',
    };
  }
}
