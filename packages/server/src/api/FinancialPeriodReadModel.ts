// packages/server/src/api/FinancialPeriodReadModel.ts

import { PostgresFinancialPeriodRepository } from './PostgresFinancialPeriodRepository';

export type EffectiveFinancialPeriodState =
  | 'OPEN'
  | 'CLOSED'
  | 'REOPENED';

export interface EffectiveFinancialPeriod {
  periodStart: Date;
  periodEnd: Date;
  state: EffectiveFinancialPeriodState;
  resolvedAt: Date;
}

/**
 * FinancialPeriodReadModel
 *
 * Deterministic, append-only resolution of the effective financial period
 * for a given (period_start, period_end) range.
 *
 * This is the ONLY place that interprets "latest effective period state"
 * from the append-only financial_periods table.
 */
export class FinancialPeriodReadModel {
  constructor(private readonly repository: PostgresFinancialPeriodRepository) {}

  async resolveEffectivePeriod(params: {
    periodFrom: Date;
    periodTo: Date;
  }): Promise<EffectiveFinancialPeriod | null> {
    const record = await this.repository.getLatestForPeriod({
      periodFrom: params.periodFrom,
      periodTo: params.periodTo,
    });

    // No record => not governed yet (explicitly represented as null)
    if (!record) return null;

    // Repository already enforces determinism (no ambiguous max(created_at))
    // We only validate state shape here for safety.
    if (record.state !== 'OPEN' && record.state !== 'CLOSED' && record.state !== 'REOPENED') {
      throw new Error(
        `Invalid financial period state '${record.state}' for ` +
          `${params.periodFrom.toISOString()} -> ${params.periodTo.toISOString()}`
      );
    }

    return {
      periodStart: record.periodStart,
      periodEnd: record.periodEnd,
      state: record.state,
      resolvedAt: record.createdAt,
    };
  }
}
