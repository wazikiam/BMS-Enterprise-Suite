// packages/server/src/api/financial-snapshots/FinancialSnapshotCreationService.ts
// FINANCIAL SNAPSHOT CREATION SERVICE (SERVER)
//
// Governance rules:
// - Period MUST exist
// - Period MUST be CLOSED
// - periodId MUST govern asOf
// - Deterministic output (same inputs => same snapshot)
// - Read-only (no DB mutation)

import { randomUUID } from 'crypto';
import { TrialBalanceReadService } from '../TrialBalanceReadService';
import { FinancialPeriodStateReadModel } from '../FinancialPeriodStateReadModel';

export type FinancialTrialBalanceSnapshot = {
  snapshotId: string;
  kind: 'FINANCIAL_TRIAL_BALANCE_SNAPSHOT_V1';

  period: {
    id: string;
    from: string;
    to: string;
  };

  asOf: string;
  currency: string;

  balances: unknown[];
};

export class FinancialSnapshotCreationService {
  constructor(
    private readonly trialBalanceRead: TrialBalanceReadService,
    private readonly periodStateReadModel: FinancialPeriodStateReadModel
  ) {}

  async createTrialBalanceSnapshot(params: {
    periodId: string;
    asOf: Date;
    currency: string;
  }): Promise<FinancialTrialBalanceSnapshot> {
    const { periodId, asOf, currency } = params;

    // 1️⃣ Resolve period by ID
    const period = await this.periodStateReadModel.getById(periodId);

    if (!period) {
      throw new Error(`financial period not found: ${periodId}`);
    }

    // 2️⃣ Period must be CLOSED
    if (period.status !== 'CLOSED') {
      throw new Error(
        `financial snapshot creation rejected: period ${period.periodId} is not CLOSED`
      );
    }

    // 3️⃣ asOf must be governed by this period
    if (asOf < period.periodFrom || asOf > period.periodTo) {
      throw new Error(
        `financial period mismatch: ${periodId} does not govern ${asOf.toISOString()}`
      );
    }

    // 4️⃣ Read deterministic trial balance
    const result = await this.trialBalanceRead.getTrialBalance({
      periodFrom: period.periodFrom,
      periodTo: period.periodTo,
      asOf,
      currency,
    });

    // 5️⃣ Assemble snapshot (pure data)
    return {
      snapshotId: randomUUID(),
      kind: 'FINANCIAL_TRIAL_BALANCE_SNAPSHOT_V1',

      period: {
        id: period.periodId,
        from: period.periodFrom.toISOString(),
        to: period.periodTo.toISOString(),
      },

      asOf: asOf.toISOString(),
      currency,

      // IMPORTANT: TrialBalanceResult exposes `accounts`
      balances: result.accounts,
    };
  }
}
