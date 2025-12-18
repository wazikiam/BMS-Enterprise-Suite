// packages/server/src/api/FinancialPeriodReadModel.ts
//
// FINANCIAL PERIOD READ ADAPTER (EVENT-SOURCED)
//
// - Single source of truth: financial_period_events
// - Delegates all interpretation to core projector
// - Deterministic
// - No writes
// - No aggregation SQL
// - No invented states

import { FinancialPeriodStateProjector } from '@bms/core/src/finance/FinancialPeriodStateProjector';
import { PostgresFinancialPeriodEventRepository } from './PostgresFinancialPeriodEventRepository';

export type EffectiveFinancialPeriodState = 'OPEN' | 'CLOSED';

export interface EffectiveFinancialPeriod {
  periodStart: Date;
  periodEnd: Date;
  state: EffectiveFinancialPeriodState;
  legalHold: boolean;
  resolvedAt: Date;
}

export class FinancialPeriodReadModel {
  constructor(
    private readonly repository: PostgresFinancialPeriodEventRepository
  ) {}

  /**
   * Resolve the effective financial period that governs a given date range.
   *
   * Returns:
   * - null → no governing period exists (explicitly allowed)
   * - EffectiveFinancialPeriod → authoritative, event-derived state
   */
  async resolveEffectivePeriod(params: {
    periodFrom: Date;
    periodTo: Date;
  }): Promise<EffectiveFinancialPeriod | null> {
    // Load all financial period events (append-only)
    const events = await this.repository.listAll();

    if (events.length === 0) return null;

    // Project authoritative state
    const index = FinancialPeriodStateProjector.projectAll(events);

    // Resolve by date (inclusive bounds)
    const period = FinancialPeriodStateProjector.resolvePeriodByDate(
      index,
      params.periodFrom
    );

    if (!period) return null;

    return {
      periodStart: period.periodFrom,
      periodEnd: period.periodTo,
      state: period.status,
      legalHold: period.legalHold,
      resolvedAt: period.lastEventAt,
    };
  }
}
