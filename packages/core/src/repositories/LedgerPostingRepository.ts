// packages/core/src/repositories/LedgerPostingRepository.ts

import { LedgerPosting } from '../domain/ledger/LedgerPosting';

/**
 * LedgerPostingRepository (CONTRACT)
 *
 * Persistence boundary for immutable double-entry postings.
 *
 * Requirements:
 * - Append-only storage
 * - No updates
 * - No deletes
 * - Deterministic ordering for queries
 * - All stored data must be auditable
 */
export interface ILedgerPostingRepository {
  /**
   * Append a new immutable posting.
   *
   * Implementations MUST be append-only.
   * If the same id is appended twice, behavior MUST be deterministic
   * (either reject or treat as idempotent), but MUST NOT mutate history.
   */
  append(posting: LedgerPosting): Promise<void>;

  /**
   * Read a posting by its unique id.
   * Returns null if not found.
   */
  getById(postingId: string): Promise<LedgerPosting | null>;

  /**
   * Deterministic list of postings.
   *
   * Ordering MUST be explicit and deterministic in implementations.
   * Default ordering expectation: occurredAt DESC, then id DESC.
   */
  list(params?: {
    periodFrom?: Date;
    periodTo?: Date;
    occurredFrom?: Date;
    occurredTo?: Date;
    referenceType?: string;
    referenceId?: string;
    limit?: number;
  }): Promise<LedgerPosting[]>;
}
