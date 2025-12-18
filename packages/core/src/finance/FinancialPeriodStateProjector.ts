// packages/core/src/finance/FinancialPeriodStateProjector.ts
// FINANCIAL PERIOD READ MODEL — PURE STATE PROJECTOR
//
// Purpose:
// - Deterministically derive financial period state from an append-only event stream.
// - Side-effect free (NO I/O).
// - Event-order safe (sorts by occurredAt, then recordedAt, then eventId).
//
// Reader tolerance:
// - Unknown events are ignored (forward-compat).
// - Invalid sequences throw (fail-fast for governance correctness).

import { FinancialPeriodEventRecord } from './FinancialPeriodGateway';
import {
  FinancialPeriodEventType,
  FinancialPeriodEventTypes,
} from './FinancialPeriodEventTypes';

export type FinancialPeriodLifecycleStatus = 'OPEN' | 'CLOSED';

export interface FinancialPeriodState {
  periodId: string;

  periodFrom: Date;
  periodTo: Date;
  label: string;

  status: FinancialPeriodLifecycleStatus;
  legalHold: boolean;

  createdAt: Date;     // occurredAt of PERIOD_CREATED
  lastEventAt: Date;   // occurredAt of last applied known event
}

export interface FinancialPeriodIndex {
  periods: ReadonlyArray<FinancialPeriodState>;
  byId: ReadonlyMap<string, FinancialPeriodState>;
}

function isKnownEventType(t: string): t is FinancialPeriodEventType {
  return (
    t === FinancialPeriodEventTypes.PERIOD_CREATED ||
    t === FinancialPeriodEventTypes.PERIOD_CLOSED ||
    t === FinancialPeriodEventTypes.PERIOD_REOPENED ||
    t === FinancialPeriodEventTypes.LEGAL_HOLD_SET ||
    t === FinancialPeriodEventTypes.LEGAL_HOLD_CLEARED
  );
}

function cloneDate(d: Date): Date {
  return new Date(d.getTime());
}

function compareEvents(
  a: FinancialPeriodEventRecord,
  b: FinancialPeriodEventRecord
): number {
  const ao = a.occurredAt.getTime();
  const bo = b.occurredAt.getTime();
  if (ao !== bo) return ao - bo;

  const ar = a.recordedAt.getTime();
  const br = b.recordedAt.getTime();
  if (ar !== br) return ar - br;

  // Deterministic tie-breaker
  if (a.eventId < b.eventId) return -1;
  if (a.eventId > b.eventId) return 1;
  return 0;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function applyEvent(
  current: FinancialPeriodState | null,
  ev: FinancialPeriodEventRecord
): FinancialPeriodState | null {
  // Reader tolerance for forward compatibility
  if (!isKnownEventType(ev.eventType)) return current;

  switch (ev.eventType) {
    case FinancialPeriodEventTypes.PERIOD_CREATED: {
      assert(
        current === null,
        `Duplicate PERIOD_CREATED for periodId=${ev.periodId}`
      );

      assert(
        ev.periodFrom instanceof Date,
        `PERIOD_CREATED missing periodFrom for periodId=${ev.periodId}`
      );
      assert(
        ev.periodTo instanceof Date,
        `PERIOD_CREATED missing periodTo for periodId=${ev.periodId}`
      );
      assert(
        typeof ev.label === 'string' && ev.label.trim() !== '',
        `PERIOD_CREATED missing label for periodId=${ev.periodId}`
      );

      return {
        periodId: ev.periodId,
        periodFrom: cloneDate(ev.periodFrom),
        periodTo: cloneDate(ev.periodTo),
        label: ev.label,

        status: 'OPEN',
        legalHold: false,

        createdAt: cloneDate(ev.occurredAt),
        lastEventAt: cloneDate(ev.occurredAt),
      };
    }

    case FinancialPeriodEventTypes.PERIOD_CLOSED: {
      assert(
        current !== null,
        `PERIOD_CLOSED before PERIOD_CREATED for periodId=${ev.periodId}`
      );
      return {
        ...current,
        status: 'CLOSED',
        lastEventAt: cloneDate(ev.occurredAt),
      };
    }

    case FinancialPeriodEventTypes.PERIOD_REOPENED: {
      assert(
        current !== null,
        `PERIOD_REOPENED before PERIOD_CREATED for periodId=${ev.periodId}`
      );
      return {
        ...current,
        status: 'OPEN',
        lastEventAt: cloneDate(ev.occurredAt),
      };
    }

    case FinancialPeriodEventTypes.LEGAL_HOLD_SET: {
      assert(
        current !== null,
        `LEGAL_HOLD_SET before PERIOD_CREATED for periodId=${ev.periodId}`
      );
      return {
        ...current,
        legalHold: true,
        lastEventAt: cloneDate(ev.occurredAt),
      };
    }

    case FinancialPeriodEventTypes.LEGAL_HOLD_CLEARED: {
      assert(
        current !== null,
        `LEGAL_HOLD_CLEARED before PERIOD_CREATED for periodId=${ev.periodId}`
      );
      return {
        ...current,
        legalHold: false,
        lastEventAt: cloneDate(ev.occurredAt),
      };
    }
  }
}

export class FinancialPeriodStateProjector {
  /**
   * Project the state of a SINGLE period from its event stream.
   */
  static projectPeriod(
    events: ReadonlyArray<FinancialPeriodEventRecord>
  ): FinancialPeriodState {
    assert(events.length > 0, 'No events provided for period projection');

    const periodId = events[0].periodId;
    for (const e of events) {
      assert(
        e.periodId === periodId,
        'projectPeriod requires events for a single periodId'
      );
    }

    const sorted = [...events].sort(compareEvents);

    let state: FinancialPeriodState | null = null;
    for (const ev of sorted) {
      state = applyEvent(state, ev);
    }

    assert(state !== null, `No PERIOD_CREATED found for periodId=${periodId}`);
    return state;
  }

  /**
   * Project ALL periods from a GLOBAL event list.
   */
  static projectAll(
    events: ReadonlyArray<FinancialPeriodEventRecord>
  ): FinancialPeriodIndex {
    const sorted = [...events].sort(compareEvents);

    const states = new Map<string, FinancialPeriodState | null>();

    for (const ev of sorted) {
      const current = states.get(ev.periodId) ?? null;
      const next = applyEvent(current, ev);
      states.set(ev.periodId, next);
    }

    const byId = new Map<string, FinancialPeriodState>();
    for (const [periodId, st] of states.entries()) {
      if (st) byId.set(periodId, st);
    }

    const periods = [...byId.values()].sort(
      (a, b) => a.periodFrom.getTime() - b.periodFrom.getTime()
    );

    return { periods, byId };
  }

  /**
   * Resolve the period that contains the given date (inclusive bounds).
   */
  static resolvePeriodByDate(
    index: FinancialPeriodIndex,
    date: Date
  ): FinancialPeriodState | null {
    const t = date.getTime();
    for (const p of index.periods) {
      if (p.periodFrom.getTime() <= t && t <= p.periodTo.getTime()) {
        return p;
      }
    }
    return null;
  }
}
