// packages/server/src/api/LedgerPostingCommandService.ts

/**
 * APPLICATION COMMAND SERVICE — LEDGER POSTING
 *
 * PURPOSE:
 * - Single authoritative application boundary for writing ledger postings
 * - Orchestrates guards + persistence
 *
 * NON-RESPONSIBILITIES:
 * - NO domain invariants (handled by LedgerPosting)
 * - NO period interpretation logic (delegated to read models)
 * - NO balance calculation
 * - NO reporting
 *
 * GUARANTEES:
 * - Append-only writes only
 * - Deterministic behavior
 * - Explicit rejection of invalid writes BEFORE persistence
 */

import { LedgerPosting } from '@bms/core/src/domain/ledger/LedgerPosting';
import { ILedgerPostingRepository } from '@bms/core/src/repositories/LedgerPostingRepository';
import { LedgerPostingWriteGuard } from './LedgerPostingWriteGuard';

/**
 * LedgerPostingCommandService
 *
 * This service is the ONLY place allowed to append ledger postings.
 *
 * All callers MUST go through this service.
 */
export class LedgerPostingCommandService {
  constructor(
    private readonly repository: ILedgerPostingRepository,
    private readonly writeGuard: LedgerPostingWriteGuard
  ) {
    if (!repository) {
      throw new Error(
        'LedgerPostingCommandService requires a LedgerPostingRepository'
      );
    }

    if (!writeGuard) {
      throw new Error(
        'LedgerPostingCommandService requires a LedgerPostingWriteGuard'
      );
    }
  }

  /**
   * Append a new immutable ledger posting.
   *
   * FLOW (STRICT ORDER):
   * 1. Guard validation (period governance, structural safety)
   * 2. Append as immutable fact
   *
   * If any step fails, NOTHING is persisted.
   */
  async append(posting: LedgerPosting): Promise<void> {
    // Step 1 — Application-level write barrier
    await this.writeGuard.assertPostingAllowed(posting);

    // Step 2 — Persist immutable fact
    await this.repository.append(posting);
  }
}
