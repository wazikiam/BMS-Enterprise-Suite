// packages/server/src/api/TrialBalanceReadService.ts
// TRIAL BALANCE READ SERVICE (SERVER)
// - Orchestrates repository
// - Assembles canonical TrialBalanceResult
// - Read-only, deterministic, fail-closed (infrastructure errors bubble to controller)

import {
  TrialBalanceQuery,
  TrialBalanceResult,
  TrialBalanceReadService as TrialBalanceReadPort,
} from '@bms/core/src/ledger/TrialBalance';
import { PostgresTrialBalanceRepository } from './PostgresTrialBalanceRepository';

export class TrialBalanceReadService implements TrialBalanceReadPort {
  constructor(
    private readonly repository: PostgresTrialBalanceRepository
  ) {}

  async getTrialBalance(
    query: TrialBalanceQuery
  ): Promise<TrialBalanceResult> {
    const accounts = await this.repository.getAccountLines(query);

    return {
      period: {
        from: query.periodFrom,
        to: query.periodTo,
        asOf: query.asOf,
      },
      currency: query.currency,
      accounts,
    };
  }
}
