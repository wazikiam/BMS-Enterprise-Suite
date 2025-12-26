// packages/server/src/settlement/ar-ledger/ARLedgerSettlementPostingEngine.ts
// Settlement → Ledger Posting Engine (SERVER)
//
// PHASE 5 — STEP 7 (POSTING ENGINE)
//
// Purpose:
// - Consume AR settlement events (legal facts)
// - Produce deterministic ledger postings
// - Enforce exactly-once ledger write per settlement event via ledgerBatchId idempotency
// - Preserve audit traceability (settlementEventId → ledgerBatchId)
//
// Non-negotiables:
// - Append-only, event-sourced
// - No balance mutation
// - Deterministic journal lines (minor units, currency-safe)
// - Period gating is enforced earlier (command path) AND must be enforced again at posting boundary

import type { SettlementJournalLine } from '@bms/core/src/settlement/ar-ledger/ARLedgerSettlementEvent';
import type {
  ARLedgerSettlementEvent,
  ARInvoicePostedToLedger,
  ARPaymentPostedToLedger,
  ARLedgerPostingReversed,
} from '@bms/core/src/settlement/ar-ledger/ARLedgerSettlementEvent';

export type LedgerPostingResult =
  | { kind: 'POSTED'; ledgerBatchId: string }
  | { kind: 'ALREADY_POSTED'; ledgerBatchId: string };

export type LedgerPostingEngine = {
  /**
   * Post a single settlement event into the Ledger (exactly-once).
   * Must be safe to call multiple times.
   */
  postSettlementEvent(event: ARLedgerSettlementEvent): Promise<LedgerPostingResult>;
};

/**
 * LedgerWriter is the ONLY boundary that actually writes to the ledger subsystem.
 * It MUST be authoritative (PostgreSQL) and MUST enforce idempotency by ledgerBatchId.
 *
 * The writer is intentionally minimal:
 * - hasBatch: detect if ledgerBatchId is already posted
 * - appendBatch: append-only write of a deterministic journal
 */
export type LedgerWriter = {
  hasBatch(ledgerBatchId: string): Promise<boolean>;

  appendBatch(input: {
    ledgerBatchId: string;
    /**
     * Strong audit link: which settlement event produced this ledger posting.
     */
    source: {
      sourceType: 'AR_LEDGER_SETTLEMENT';
      settlementEventId: string;
      settlementEventType: string;
      settlementId: string;
    };
    /**
     * Accounting date expressed as YYYY-MM-DD (period gating uses this).
     * The ledger subsystem must enforce posting into an OPEN period.
     */
    accountingDate: string;
    /**
     * Deterministic journal lines (minor units).
     */
    journal: ReadonlyArray<SettlementJournalLine>;
    /**
     * Actor/audit fields.
     */
    actor: {
      actorId: string;
      actorRoles: readonly string[];
      reason: string;
    };
  }): Promise<void>;
};

export type SettlementAccountingDateResolver = {
  /**
   * Resolve the accounting date for a settlement event.
   *
   * Rationale:
   * - Settlement events contain occurredAt, but accountingDate is part of command intent.
   * - Some systems embed accountingDate in payload; others resolve from command/event envelope.
   * - We keep this deterministic by injecting the resolver.
   */
  resolveAccountingDate(event: ARLedgerSettlementEvent): Promise<string>; // YYYY-MM-DD
};

export class ARLedgerSettlementPostingEngine implements LedgerPostingEngine {
  constructor(
    private readonly ledgerWriter: LedgerWriter,
    private readonly accountingDateResolver: SettlementAccountingDateResolver
  ) {}

  async postSettlementEvent(event: ARLedgerSettlementEvent): Promise<LedgerPostingResult> {
    const posting = this.toPosting(event);

    const already = await this.ledgerWriter.hasBatch(posting.ledgerBatchId);
    if (already) {
      return { kind: 'ALREADY_POSTED', ledgerBatchId: posting.ledgerBatchId };
    }

    const accountingDate = await this.accountingDateResolver.resolveAccountingDate(event);

    await this.ledgerWriter.appendBatch({
      ledgerBatchId: posting.ledgerBatchId,
      source: {
        sourceType: 'AR_LEDGER_SETTLEMENT',
        settlementEventId: event.eventId,
        settlementEventType: event.eventType,
        settlementId: event.settlementId,
      },
      accountingDate,
      journal: posting.journal,
      actor: {
        actorId: event.actorId,
        actorRoles: event.actorRoles,
        reason: event.reason,
      },
    });

    return { kind: 'POSTED', ledgerBatchId: posting.ledgerBatchId };
  }

  private toPosting(event: ARLedgerSettlementEvent): { ledgerBatchId: string; journal: ReadonlyArray<SettlementJournalLine> } {
    switch (event.eventType) {
      case 'AR_INVOICE_POSTED_TO_LEDGER':
        return this.fromInvoicePosted(event);

      case 'AR_PAYMENT_POSTED_TO_LEDGER':
        return this.fromPaymentPosted(event);

      case 'AR_LEDGER_POSTING_REVERSED':
        return this.fromReversal(event);

      default:
        return assertNever(event);
    }
  }

  private fromInvoicePosted(e: ARInvoicePostedToLedger): { ledgerBatchId: string; journal: ReadonlyArray<SettlementJournalLine> } {
    return {
      ledgerBatchId: e.ledgerBatchId,
      journal: e.journal,
    };
  }

  private fromPaymentPosted(e: ARPaymentPostedToLedger): { ledgerBatchId: string; journal: ReadonlyArray<SettlementJournalLine> } {
    return {
      ledgerBatchId: e.ledgerBatchId,
      journal: e.journal,
    };
  }

  private fromReversal(e: ARLedgerPostingReversed): { ledgerBatchId: string; journal: ReadonlyArray<SettlementJournalLine> } {
    // By contract: reversalJournal is the deterministic mirror of the original journal.
    return {
      ledgerBatchId: e.ledgerBatchId,
      journal: e.reversalJournal,
    };
  }
}

export function assertNever(x: never): never {
  throw new Error(`Unhandled settlement event: ${JSON.stringify(x)}`);
}
