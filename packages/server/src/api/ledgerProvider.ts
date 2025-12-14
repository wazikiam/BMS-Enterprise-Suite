// packages/server/src/api/ledgerProvider.ts

import { getPostgresPool } from '../db/PostgresClient';

import { PostgresLedgerPostingRepository } from './PostgresLedgerPostingRepository';
import { PostgresFinancialPeriodRepository } from './PostgresFinancialPeriodRepository';
import { FinancialPeriodReadModel } from './FinancialPeriodReadModel';
import { LedgerPostingWriteGuard } from './LedgerPostingWriteGuard';
import { LedgerPostingCommandService } from './LedgerPostingCommandService';

/**
 * LedgerProvider
 *
 * Application boundary for ALL ledger writes.
 *
 * Responsibilities:
 * - Compose infrastructure adapters
 * - Resolve effective financial period
 * - Enforce CLOSED-period write barrier
 *
 * NO HTTP
 * NO framework logic
 * NO domain mutation
 */
export function createLedgerProvider() {
  const pool = getPostgresPool();

  // Persistence
  const ledgerPostingRepository = new PostgresLedgerPostingRepository(pool);
  const financialPeriodRepository = new PostgresFinancialPeriodRepository(pool);

  // Deterministic read model (single interpretation point)
  const financialPeriodReadModel = new FinancialPeriodReadModel(
    financialPeriodRepository
  );

  // Write barrier
  const writeGuard = new LedgerPostingWriteGuard(
    financialPeriodReadModel
  );

  // Command service (ONLY allowed write path)
  const ledgerPostingService = new LedgerPostingCommandService(
    ledgerPostingRepository,
    writeGuard
  );

  return {
    ledgerPostingService,
  };
}

export type LedgerProvider = ReturnType<typeof createLedgerProvider>;
