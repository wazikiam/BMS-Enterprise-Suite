// packages/core/src/repositories/LedgerEntryRepository.ts

import { LedgerEntry } from '../domain/ledger/LedgerEntry';

/**
 * LedgerEntryRepository (CONTRACT)
 *
 * Read-optimized boundary for querying immutable ledger entries.
 *
 * Why this exists separately from postings:
 * - Postings are the atomic accounting fact (write model)
 * - Entries are the dominant query surface (read model)
 *
 * Implementations MAY persist postings and project entries,
 * but core only defines contracts.
 *
 * Requirements:
 * - Append-only facts
 * - No updates
 * - No deletes
 * - Deterministic ordering for queries
 */
export interface ILedgerEntryRepository {
  /**
   * Read an entry by id.
   * Returns null if not found.
   */
  getById(entryId: string): Promise<LedgerEntry | null>;

  /**
   * Deterministic list of entries.
   *
   * Ordering MUST be explicit and deterministic in implementations.
   * Default ordering expectation: occurredAt DESC, then id DESC.
   */
  list(params?: {
    periodFrom?: Date;
    periodTo?: Date;
    occurredFrom?: Date;
    occurredTo?: Date;
    accountCode?: string;
    side?: 'DEBIT' | 'CREDIT';
    currency?: string;
    referenceType?: string;
    referenceId?: string;
    limit?: number;
  }): Promise<LedgerEntry[]>;
}
