// packages/server/src/api/ledgerBalanceProvider.ts

import { getPostgresPool } from '../db/PostgresClient';

import { LedgerBalanceQueryImpl } from '@bms/core/src/ledger-balances/LedgerBalanceQueryImpl';

import { PostgresLedgerBalanceRepository } from './PostgresLedgerBalanceRepository';
import { PostgresFinancialPeriodRepository } from './PostgresFinancialPeriodRepository';
import { FinancialPeriodReadModel } from './FinancialPeriodReadModel';

/**
 * PeriodReadGuard
 *
 * Single authoritative governance seam for READ access to ledger balances.
 *
 * Rules:
 * - If NO financial period exists → allow (ungoverned)
 * - OPEN / REOPENED → allow
 * - CLOSED → reject
 *
 * This mirrors snapshot + ledger write governance.
 */
export interface PeriodReadGuard {
  assertReadAllowed(params: {
    periodFrom?: Date;
    periodTo?: Date;
    asOf: Date;
  }): Promise<void>;
}

class DatabaseBackedPeriodReadGuard implements PeriodReadGuard {
  constructor(
    private readonly periodReadModel: FinancialPeriodReadModel
  ) {}

  async assertReadAllowed(params: {
    periodFrom?: Date;
    periodTo?: Date;
    asOf: Date;
  }): Promise<void> {
    // If no period specified, read is unbounded → allowed
    if (!params.periodFrom || !params.periodTo) {
      return;
    }

    const effective = await this.periodReadModel.resolveEffectivePeriod({
      periodFrom: params.periodFrom,
      periodTo: params.periodTo,
    });

    // Ungoverned period → allowed
    if (!effective) return;

    if (effective.state === 'CLOSED') {
      throw new Error(
        `Financial period ${effective.periodStart.toISOString()} -> ${effective.periodEnd.toISOString()} is CLOSED`
      );
    }
  }
}

/**
 * LedgerBalanceProvider
 *
 * Application boundary for ledger balance reads.
 * - Composes repositories
 * - Enforces period governance
 * - Exposes read-only query
 */
export function createLedgerBalanceProvider() {
  const pool = getPostgresPool();

  // Persistence
  const balanceRepository = new PostgresLedgerBalanceRepository(pool);
  const financialPeriodRepository = new PostgresFinancialPeriodRepository(pool);

  // Deterministic period interpreter
  const financialPeriodReadModel = new FinancialPeriodReadModel(
    financialPeriodRepository
  );

  // Governance
  const periodReadGuard: PeriodReadGuard =
    new DatabaseBackedPeriodReadGuard(financialPeriodReadModel);

  // Pure core query
  const baseQuery = new LedgerBalanceQueryImpl(balanceRepository);

  // Guarded query
  const guardedQuery = {
    async getBalance(params: {
      accountId: string;
      periodFrom?: Date;
      periodTo?: Date;
      asOf: Date;
    }) {
      await periodReadGuard.assertReadAllowed({
        periodFrom: params.periodFrom,
        periodTo: params.periodTo,
        asOf: params.asOf,
      });

      return baseQuery.getBalance(params);
    },
  };

  return {
    ledgerBalanceQuery: guardedQuery,
  };
}

export type LedgerBalanceProvider = ReturnType<
  typeof createLedgerBalanceProvider
>;
