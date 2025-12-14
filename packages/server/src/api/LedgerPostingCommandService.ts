// packages/server/src/api/LedgerPostingCommandService.ts

import { LedgerPosting } from '@bms/core/src/domain/ledger/LedgerPosting';
import { ILedgerPostingRepository } from '@bms/core/src/repositories/LedgerPostingRepository';
import { LedgerPostingWriteGuard } from './LedgerPostingWriteGuard';

/**
 * LedgerPostingCommandService
 *
 * The ONLY allowed application entry point
 * for appending ledger postings.
 *
 * All writes MUST pass through this service.
 */
export class LedgerPostingCommandService {
  constructor(
    private readonly repository: ILedgerPostingRepository,
    private readonly writeGuard: LedgerPostingWriteGuard
  ) {}

  async append(posting: LedgerPosting): Promise<void> {
    await this.writeGuard.assertCanPost(posting);
    await this.repository.append(posting);
  }
}
