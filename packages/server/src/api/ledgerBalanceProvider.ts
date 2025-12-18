// packages/server/src/api/ledgerBalanceProvider.ts
//
// LEDGER BALANCE PROVIDER (READ SIDE)
//
// - READS are never blocked by period state
// - Period governance is still resolved deterministically
// - Financial periods are EVENT-SOURCED
// - No table-derived state

import { getPostgresPool } from '../db/PostgresClient';

import { LedgerBalanceQueryImpl } from '@bms/core/src/ledger-balances/LedgerBalanceQueryImpl';

import { PostgresLedgerBalanceRepository } from './PostgresLedgerBalanceRepository';
import { PostgresFinancialPeriodEventRepository } from './PostgresFinancialPeriodEventRepository';
import { FinancialPeriodReadModel } from './FinancialPeriodReadModel';

/**
 * PeriodReadGuard
 *
 * Single governance seam for READ access.
 * Reads are ALWAYS allowed.
 * This guard exists for explicitness and audit traceability.
 */
export interface PeriodReadGuard {
  assertReadAllowed(params: {
    periodFrom?: Date;
    periodTo?: Date;
    asOf: Date;
  }): Promise<void>;
}

class EventBackedPeriodReadGuard implements PeriodReadGuard {
  constructor(private readonly periodReadModel: FinancialPeriodReadModel) {}

  async assertReadAllowed(params: {
    periodFrom?: Date;
    periodTo?: Date;
    asOf: Date;
  }): Promise<void> {
    if (!params.periodFrom || !params.periodTo) return;

    // Resolve for auditability only.
    // READS ARE NEVER BLOCKED.
    await this.periodReadModel.resolveEffectivePeriod({
      periodFrom: params.periodFrom,
      periodTo: params.periodTo,
    });
  }
}

/**
 * LedgerBalanceProvider
 *
 * Application boundary for READ-ONLY ledger balances.
 */
export function createLedgerBalanceProvider() {
  const pool = getPostgresPool();

  const balanceRepository = new PostgresLedgerBalanceRepository(pool);

  // EVENT-SOURCED financial period governance
  const financialPeriodEventRepository =
    new PostgresFinancialPeriodEventRepository(pool);

  const financialPeriodReadModel = new FinancialPeriodReadModel(
    financialPeriodEventRepository
  );

  const periodReadGuard: PeriodReadGuard =
    new EventBackedPeriodReadGuard(financialPeriodReadModel);

  const baseQuery = new LedgerBalanceQueryImpl(balanceRepository);

  const ledgerBalanceQuery = {
    async getAccountBalance(params: {
      accountId: string;
      currency: string;
      asOf: Date;
      periodFrom?: Date;
      periodTo?: Date;
    }) {
      await periodReadGuard.assertReadAllowed({
        periodFrom: params.periodFrom,
        periodTo: params.periodTo,
        asOf: params.asOf,
      });

      return baseQuery.getAccountBalance({
        accountId: params.accountId,
        currency: params.currency,
        asOf: params.asOf,
      });
    },

    async getAccountBalances(params: {
      accountIds: string[];
      currency: string;
      asOf: Date;
    }) {
      return baseQuery.getAccountBalances(params);
    },
  };

  return {
    ledgerBalanceQuery,
    financialPeriodReadModel,
  };
}

export type LedgerBalanceProvider = ReturnType<
  typeof createLedgerBalanceProvider
>;
