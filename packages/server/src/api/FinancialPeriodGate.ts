// packages/server/src/api/FinancialPeriodGate.ts
// FINANCIAL PERIOD HARD GATE (WRITE-TIME GOVERNANCE)
//
// Rejects ledger writes whose occurredAt falls inside a CLOSED or LOCKED period.
// FAIL-CLOSED on governance anomalies:
// - If period streams exist but cannot be projected deterministically,
//   ledger writes are rejected (audit safety).

import { PostgresFinancialPeriodEventRepository } from './PostgresFinancialPeriodEventRepository';
import { FinancialPeriodStateProjector } from './FinancialPeriodStateProjector';

export class PeriodClosedError extends Error {
  readonly periodId: string;
  readonly periodFrom: Date;
  readonly periodTo: Date;

  constructor(args: {
    periodId: string;
    periodFrom: Date;
    periodTo: Date;
    occurredAt: Date;
  }) {
    super(
      `Ledger write rejected: occurredAt ${args.occurredAt.toISOString()} is inside CLOSED/LOCKED period ${args.periodId}`
    );
    this.periodId = args.periodId;
    this.periodFrom = args.periodFrom;
    this.periodTo = args.periodTo;
  }
}

export class FinancialPeriodGovernanceError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export class FinancialPeriodGate {
  constructor(private readonly repo: PostgresFinancialPeriodEventRepository) {}

  async assertAllowsLedgerWrite(occurredAt: Date): Promise<void> {
    const events = await this.repo.listAll();

    // No period governance events => explicitly ungovverned (allowed).
    if (!events || events.length === 0) return;

    const byPeriod = new Map<string, any[]>();
    for (const e of events) {
      const list = byPeriod.get(e.periodId) ?? [];
      list.push(e);
      byPeriod.set(e.periodId, list);
    }

    for (const [, evs] of byPeriod.entries()) {
      // Deterministic order
      evs.sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());

      let state;
      try {
        state = FinancialPeriodStateProjector.project(evs);
      } catch (err: any) {
        // FAIL-CLOSED: governance anomaly must block writes
        throw new FinancialPeriodGovernanceError(
          `Financial period governance anomaly: cannot project period state. ` +
            `Reason: ${err?.message ?? 'Unknown error'}`
        );
      }

      if (
        (state.status === 'CLOSED' || state.status === 'LOCKED') &&
        occurredAt >= state.periodFrom &&
        occurredAt <= state.periodTo
      ) {
        throw new PeriodClosedError({
          periodId: state.periodId,
          periodFrom: state.periodFrom,
          periodTo: state.periodTo,
          occurredAt,
        });
      }
    }
  }
}
