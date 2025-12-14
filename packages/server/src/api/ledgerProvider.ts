// packages/server/src/api/ledgerProvider.ts

import { getPostgresPool } from '../db/PostgresClient';

import { PostgresLedgerPostingRepository } from './PostgresLedgerPostingRepository';
import { FinancialPeriodReadModel } from './FinancialPeriodReadModel';
import { PostgresFinancialPeriodRepository } from './PostgresFinancialPeriodRepository';

import { LedgerPostingWriteGuard } from './LedgerPostingWriteGuard';
import { LedgerPostingCommandService } from './LedgerPostingCommandService';
import { LedgerPostingController } from './LedgerPostingController';

export function createLedgerProvider() {
  const pool = getPostgresPool();

  const ledgerPostingRepository =
    new PostgresLedgerPostingRepository(pool);

  const financialPeriodRepository =
    new PostgresFinancialPeriodRepository(pool);

  const periodReadModel =
    new FinancialPeriodReadModel(financialPeriodRepository);

  const writeGuard =
    new LedgerPostingWriteGuard(periodReadModel);

  const commandService =
    new LedgerPostingCommandService(
      ledgerPostingRepository,
      writeGuard
    );

  const controller =
    new LedgerPostingController(commandService);

  return {
    controller,
  };
}
