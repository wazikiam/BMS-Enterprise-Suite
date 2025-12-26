// packages/server/src/settlement/ar-ledger/PostgresLedgerWriter.ts
// Concrete LedgerWriter adapter (PostgreSQL, append-only)
//
// PHASE 5 — STEP 8 (FINAL)
//
// Purpose:
// - Bridge settlement posting engine → authoritative ledger repository
// - Map settlement journal lines → real LedgerEntry domain objects
// - Enforce exactly-once semantics via ledgerBatchId
// - Respect LedgerPosting invariants (balanced, same currency, same period)

import { LedgerWriter } from './ARLedgerSettlementPostingEngine';
import { PostgresLedgerPostingRepository } from '../../api/PostgresLedgerPostingRepository';
import { LedgerPosting } from '@bms/core/src/domain/ledger/LedgerPosting';
import { LedgerEntry } from '@bms/core/src/domain/ledger/LedgerEntry';
import { LedgerSide } from '@bms/core/src/domain/ledger/LedgerSide';
import { randomUUID } from 'crypto';

/**
 * PeriodResolver is REQUIRED.
 * Ledger entries MUST carry correct accounting period boundaries.
 */
export type PeriodResolver = {
  /**
   * Resolve the accounting period for a given accounting date.
   * Must throw if:
   * - period not found
   * - period closed
   * - period under legal hold
   */
  resolvePeriod(accountingDate: string): Promise<{
    periodStart: Date;
    periodEnd: Date;
  }>;
};

export class PostgresLedgerWriter implements LedgerWriter {
  constructor(
    private readonly postingRepo: PostgresLedgerPostingRepository,
    private readonly periodResolver: PeriodResolver
  ) {
    if (!postingRepo) {
      throw new Error(
        'PostgresLedgerWriter requires PostgresLedgerPostingRepository'
      );
    }
    if (!periodResolver) {
      throw new Error(
        'PostgresLedgerWriter requires PeriodResolver'
      );
    }
  }

  /**
   * Idempotency check.
   * Exactly-once guarantee is enforced by:
   * - deterministic ledgerBatchId
   * - ledger_postings.id PRIMARY KEY
   */
  async hasBatch(ledgerBatchId: string): Promise<boolean> {
    const existing = await this.postingRepo.getById(ledgerBatchId);
    return existing !== null;
  }

  /**
   * Append a deterministic ledger posting.
   *
   * Mapping rules:
   * - ledgerBatchId → LedgerPosting.id
   * - settlement journal → LedgerEntry[]
   * - amountMinor → amount (major units)
   * - direction → LedgerSide
   * - audit traceability via LedgerEntry.reference*
   */
  async appendBatch(input: {
    ledgerBatchId: string;
    source: {
      sourceType: 'AR_LEDGER_SETTLEMENT';
      settlementEventId: string;
    };
    accountingDate: string; // YYYY-MM-DD
    journal: ReadonlyArray<{
      accountCode: string;
      direction: 'DEBIT' | 'CREDIT';
      amountMinor: number;
      currency: string;
      memo?: string;
    }>;
    actor: {
      actorId: string;
      actorRoles: readonly string[];
      reason: string;
    };
  }): Promise<void> {
    const occurredAt = new Date(input.accountingDate);

    const period = await this.periodResolver.resolvePeriod(
      input.accountingDate
    );

    const entries: LedgerEntry[] = input.journal.map((line) => {
      if (!Number.isInteger(line.amountMinor)) {
        throw new Error('amountMinor must be an integer');
      }

      const amountMajor = line.amountMinor / 100;

      return new LedgerEntry({
        id: randomUUID(),
        accountCode: line.accountCode,
        side:
          line.direction === 'DEBIT'
            ? LedgerSide.DEBIT
            : LedgerSide.CREDIT,
        amount: amountMajor,
        currency: line.currency,
        occurredAt,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        referenceType: input.source.sourceType,
        referenceId: input.source.settlementEventId,
      });
    });

    const posting = new LedgerPosting({
      id: input.ledgerBatchId,
      entries,
      occurredAt,
    });

    // Append-only, idempotent by posting.id
    await this.postingRepo.append(posting);
  }
}
