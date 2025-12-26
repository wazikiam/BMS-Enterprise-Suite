// packages/server/src/settlement/ap-ledger/APLedgerSettlementPostingEngine.ts
// AP → LEDGER SETTLEMENT POSTING ENGINE (SERVER)
//
// PHASE 7 — STEP 5
//
// Role:
// - Execute ledger writes EXACTLY ONCE per settlement event via ledgerBatchId
// - Deterministic mapping: settlement event -> ledger batch write
// - No domain decisions here: journal is already deterministic in the settlement event
//
// Guarantees:
// - Authoritative idempotency (hasBatch)
// - Append-only ledger writes (appendBatch)
// - Audit traceability: settlementEventId ⇄ ledgerBatchId
//
// Non-negotiables:
// - NO balance mutation
// - NO CRUD accounting
// - Ledger is the system of record
// - PostgreSQL is authoritative (writer implementation)

import type {
  APLedgerSettlementEvent,
  APInvoicePostedToLedger,
  APPaymentPostedToLedger,
  APLedgerPostingReversed,
  SettlementJournalLine,
} from '@bms/core/src/settlement/ap-ledger/APLedgerSettlementEvent';

export type PostingResult =
  | { kind: 'POSTED'; ledgerBatchId: string }
  | { kind: 'ALREADY_POSTED'; ledgerBatchId: string };

export type LedgerWriter = {
  /**
   * Authoritative idempotency check.
   * Must be backed by PostgreSQL.
   */
  hasBatch(ledgerBatchId: string): Promise<boolean>;

  /**
   * Append-only ledger write of a deterministic journal batch.
   * Must be backed by PostgreSQL and must be append-only.
   */
  appendBatch(input: {
    ledgerBatchId: string;

    /**
     * Audit metadata. Writer MUST persist this in the ledger posting payload
     * (or a canonical metadata envelope) so reconciliation is possible.
     */
    meta: {
      sourceType: 'AP_LEDGER_SETTLEMENT';
      settlementEventId: string;
      settlementId: string;
      eventType: APLedgerSettlementEvent['eventType'];
    };

    journal: readonly SettlementJournalLine[];

    occurredAt: string; // ISO-8601 UTC string
  }): Promise<void>;
};

export class APLedgerSettlementPostingEngine {
  constructor(private readonly ledgerWriter: LedgerWriter) {}

  /**
   * Post a settlement event to the ledger exactly once.
   *
   * Determinism:
   * - For a given settlement event, ledgerBatchId is stable.
   * - The journal is taken from the event payload, not recalculated here.
   */
  async post(event: APLedgerSettlementEvent): Promise<PostingResult> {
    const posting = this.toPosting(event);

    const already = await this.ledgerWriter.hasBatch(posting.ledgerBatchId);
    if (already) {
      return { kind: 'ALREADY_POSTED', ledgerBatchId: posting.ledgerBatchId };
    }

    await this.ledgerWriter.appendBatch({
      ledgerBatchId: posting.ledgerBatchId,
      meta: {
        sourceType: 'AP_LEDGER_SETTLEMENT',
        settlementEventId: event.eventId,
        settlementId: event.settlementId,
        eventType: event.eventType,
      },
      journal: posting.journal,
      occurredAt: event.occurredAt,
    });

    return { kind: 'POSTED', ledgerBatchId: posting.ledgerBatchId };
  }

  private toPosting(event: APLedgerSettlementEvent): {
    ledgerBatchId: string;
    journal: readonly SettlementJournalLine[];
  } {
    switch (event.eventType) {
      case 'AP_INVOICE_POSTED_TO_LEDGER':
        return this.fromInvoicePosted(event);

      case 'AP_PAYMENT_POSTED_TO_LEDGER':
        return this.fromPaymentPosted(event);

      case 'AP_LEDGER_POSTING_REVERSED':
        return this.fromReversal(event);

      default:
        return assertNever(event);
    }
  }

  private fromInvoicePosted(e: APInvoicePostedToLedger): {
    ledgerBatchId: string;
    journal: readonly SettlementJournalLine[];
  } {
    return {
      ledgerBatchId: e.ledgerBatchId,
      journal: e.journal,
    };
  }

  private fromPaymentPosted(e: APPaymentPostedToLedger): {
    ledgerBatchId: string;
    journal: readonly SettlementJournalLine[];
  } {
    return {
      ledgerBatchId: e.ledgerBatchId,
      journal: e.journal,
    };
  }

  private fromReversal(e: APLedgerPostingReversed): {
    ledgerBatchId: string;
    journal: readonly SettlementJournalLine[];
  } {
    // Prefer explicit reversalJournal when present (audit-grade symmetry).
    // Fallback: invert the original journal deterministically.
    const anyE = e as any;

    const reversalJournal: readonly SettlementJournalLine[] =
      (anyE.reversalJournal as readonly SettlementJournalLine[] | undefined) ??
      Object.freeze(
        e.journal.map(
          (l): SettlementJournalLine => ({
            accountCode: l.accountCode,
            direction: l.direction === 'DEBIT' ? 'CREDIT' : 'DEBIT',
            amountMinor: l.amountMinor,
            currency: l.currency,
            memo: `REVERSAL: ${l.memo ?? ''}`.trim(),
          })
        )
      );

    return {
      ledgerBatchId: e.ledgerBatchId,
      journal: reversalJournal,
    };
  }
}

export function assertNever(x: never): never {
  throw new Error(`Unhandled APLedgerSettlementEvent in posting engine: ${JSON.stringify(x)}`);
}
