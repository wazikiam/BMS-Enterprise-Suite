// packages/server/src/settlement/ap-ledger/PostgresAPLedgerWriter.ts
// POSTGRES AP LEDGER WRITER (SERVER)
//
// PHASE 7 — STEP 6
//
// Role:
// - Concrete PostgreSQL-backed implementation of LedgerWriter
// - Converts settlement journals into immutable LedgerPosting records
// - Enforces exactly-once execution via ledgerBatchId
//
// Guarantees:
// - Append-only ledger writes
// - Idempotency by ledgerBatchId
// - Deterministic mapping
// - Audit traceability preserved in posting payload
//
// Non-negotiables:
// - NO updates
// - NO deletes
// - NO balance mutation
// - Ledger is system of record
// - PostgreSQL is authoritative

import { Pool } from 'pg';

import { LedgerPosting } from '@bms/core/src/domain/ledger/LedgerPosting';
import { LedgerEntry } from '@bms/core/src/domain/ledger/LedgerEntry';
import { LedgerSide } from '@bms/core/src/domain/ledger/LedgerSide';

import { PostgresLedgerPostingRepository } from '../../api/PostgresLedgerPostingRepository';
import type { SettlementJournalLine } from '@bms/core/src/settlement/ap-ledger/APLedgerSettlementEvent';
import type { LedgerWriter } from './APLedgerSettlementPostingEngine';

export class PostgresAPLedgerWriter implements LedgerWriter {
  private readonly postings: PostgresLedgerPostingRepository;

  constructor(private readonly pool: Pool) {
    if (!pool) {
      throw new Error('PostgresAPLedgerWriter requires a database pool');
    }
    this.postings = new PostgresLedgerPostingRepository(pool);
  }

  /**
   * Authoritative idempotency check.
   *
   * Strategy:
   * - ledgerBatchId is used as the LedgerPosting.id
   * - If a posting with that id exists, the batch is already posted
   */
  async hasBatch(ledgerBatchId: string): Promise<boolean> {
    const existing = await this.postings.getById(ledgerBatchId);
    return existing !== null;
  }

  /**
   * Append a deterministic ledger batch.
   *
   * Mapping rules:
   * - ledgerBatchId => LedgerPosting.id
   * - Each SettlementJournalLine => one LedgerEntry
   * - Amounts are converted from minor units to major units
   *   (minor -> number) deterministically
   */
  async appendBatch(input: {
    ledgerBatchId: string;
    meta: {
      sourceType: 'AP_LEDGER_SETTLEMENT';
      settlementEventId: string;
      settlementId: string;
      eventType: string;
    };
    journal: readonly SettlementJournalLine[];
    occurredAt: string; // ISO-8601
  }): Promise<void> {
    // Deterministic timestamps
    const occurredAt = new Date(input.occurredAt);

    // All entries must share currency and period; enforced by LedgerPosting
    // Period derivation rule (explicit and deterministic):
    // - periodStart = date at 00:00:00.000Z
    // - periodEnd   = next day at 00:00:00.000Z
    const periodStart = new Date(Date.UTC(
      occurredAt.getUTCFullYear(),
      occurredAt.getUTCMonth(),
      occurredAt.getUTCDate(),
      0, 0, 0, 0
    ));
    const periodEnd = new Date(Date.UTC(
      occurredAt.getUTCFullYear(),
      occurredAt.getUTCMonth(),
      occurredAt.getUTCDate() + 1,
      0, 0, 0, 0
    ));

    const entries = input.journal.map((line, idx) => {
      const side =
        line.direction === 'DEBIT'
          ? LedgerSide.DEBIT
          : LedgerSide.CREDIT;

      // Convert minor units to major units deterministically
      // (Core ledger uses major units as number)
      const amountMajor = line.amountMinor / 100;

      return new LedgerEntry({
        id: `${input.ledgerBatchId}:${idx}`,
        accountCode: line.accountCode,
        side,
        amount: amountMajor,
        currency: line.currency,
        occurredAt,
        periodStart,
        periodEnd,
        referenceType: input.meta.sourceType,
        referenceId: input.meta.settlementEventId,
      });
    });

    const posting = new LedgerPosting({
      id: input.ledgerBatchId,
      entries,
      occurredAt,
    });

    // Append-only, idempotent by primary key
    await this.postings.append(posting);
  }
}
