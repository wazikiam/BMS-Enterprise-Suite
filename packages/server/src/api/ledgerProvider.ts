// packages/server/src/api/ledgerProvider.ts

import { getPostgresPool } from '../db/PostgresClient';

import { PostgresLedgerPostingRepository } from './PostgresLedgerPostingRepository';
import { PostgresLedgerBalanceRepository } from './PostgresLedgerBalanceRepository';

import { LedgerBalanceQueryImpl } from '@bms/core/src/ledger-balances/LedgerBalanceQueryImpl';
import { LedgerBalanceCalculator } from '@bms/core/src/ledger-balances/LedgerBalanceCalculator';

export function createLedgerProvider() {
  const pool = getPostgresPool();

  // Repositories
  const postingRepository = new PostgresLedgerPostingRepository(pool);
  const balanceRepository = new PostgresLedgerBalanceRepository(pool);

  // Calculator (pure, deterministic)
  const calculator = new LedgerBalanceCalculator();

  // Read model
  const ledgerBalanceQuery = new LedgerBalanceQueryImpl(
    balanceRepository,
    calculator
  );

  return {
    ledgerBalanceQuery,
  };
}

export type LedgerProvider = ReturnType<typeof createLedgerProvider>;
