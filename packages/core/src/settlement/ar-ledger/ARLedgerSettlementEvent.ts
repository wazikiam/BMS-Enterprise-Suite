// packages/core/src/settlement/ar-ledger/ARLedgerSettlementEvent.ts
//
// PHASE 5 (Ledger Settlement) — STEP 1 (CONTRACT ONLY)
//
// Purpose:
// - Define the ONLY allowed event types for AR → Ledger settlement.
// - Compile-time exhaustiveness for settlement event handling.
// - No persistence, no handlers, no SQL, no side effects.
//
// Non-negotiables:
// - PostgreSQL authoritative (handled in server layer)
// - Event-sourced, append-only, audit-grade
// - Read models derived ONLY from events
// - Invoices never own money; payments are independent legal facts
// - Ledger is system of record; settlement is the controlled bridge

export type ARLedgerSettlementEventType =
  | 'AR_INVOICE_POSTED_TO_LEDGER'
  | 'AR_PAYMENT_POSTED_TO_LEDGER'
  | 'AR_LEDGER_POSTING_REVERSED';

export const AR_LEDGER_SETTLEMENT_EVENT_TYPES: ReadonlyArray<ARLedgerSettlementEventType> = [
  'AR_INVOICE_POSTED_TO_LEDGER',
  'AR_PAYMENT_POSTED_TO_LEDGER',
  'AR_LEDGER_POSTING_REVERSED',
] as const;

/**
 * Posting direction within a journal line.
 * CREDIT/DEBIT is represented explicitly to avoid sign ambiguity.
 */
export type PostingDirection = 'DEBIT' | 'CREDIT';

/**
 * Minimal, deterministic journal line specification.
 * - accountCode: canonical chart-of-accounts code (string to keep core decoupled)
 * - amountMinor: integer in minor units to preserve exactness (e.g., cents)
 * - currency: ISO 4217 currency code
 */
export type SettlementJournalLine = {
  accountCode: string;
  direction: PostingDirection;
  amountMinor: number; // MUST be integer minor units (no floats)
  currency: string; // ISO 4217 (e.g., "MAD", "EUR", "USD")
  memo?: string;
};

/**
 * Shared governance/audit fields for all settlement events.
 * Note: actor fields are enforced at boundaries; core defines contract only.
 */
export type SettlementEventBase = {
  eventId: string; // uuid
  eventType: ARLedgerSettlementEventType;
  occurredAt: string; // ISO-8601 UTC string
  actorId: string;
  actorRoles: ReadonlyArray<string>;
  reason: string;

  /**
   * Idempotency key used at command boundary to guarantee exactly-once intent.
   * Stored on event for forensic traceability.
   */
  idempotencyKey: string;

  /**
   * Settlement group identifier.
   * Allows deterministic grouping when one source fact emits multiple postings.
   */
  settlementId: string; // uuid
};

/**
 * Posts an AR Invoice legal fact into the Ledger as a deterministic journal.
 *
 * Intent:
 * - Invoice issued → Revenue + Accounts Receivable
 *
 * Notes:
 * - This event MUST be derived from AR invoice events, not from mutable invoice state.
 * - The journal lines are included to make the settlement auditable and deterministic.
 */
export type ARInvoicePostedToLedger = SettlementEventBase & {
  eventType: 'AR_INVOICE_POSTED_TO_LEDGER';

  invoiceId: string; // uuid
  customerId: string; // uuid

  /**
   * Reference to the ledger posting result (batch / journal id) once written.
   * This is a reference identifier only; no ledger mutation here.
   */
  ledgerBatchId: string; // uuid (or deterministic id)

  /**
   * Deterministic journal (minor units, currency-safe).
   * Expected shape (policy, not enforced here):
   * - Debit: Accounts Receivable
   * - Credit: Revenue (and optionally taxes/discounts, if modeled)
   */
  journal: ReadonlyArray<SettlementJournalLine>;
};

/**
 * Posts an AR Payment legal fact into the Ledger as a deterministic journal.
 *
 * Intent:
 * - Payment received → Cash/Bank + Accounts Receivable
 *
 * Notes:
 * - Payments are independent legal facts and MUST NOT be embedded into invoices.
 * - Journal is included to guarantee deterministic, auditable settlement.
 */
export type ARPaymentPostedToLedger = SettlementEventBase & {
  eventType: 'AR_PAYMENT_POSTED_TO_LEDGER';

  paymentId: string; // uuid
  customerId: string; // uuid

  /**
   * Ledger posting reference identifier (batch / journal id).
   */
  ledgerBatchId: string; // uuid (or deterministic id)

  /**
   * Deterministic journal (minor units, currency-safe).
   * Expected shape (policy, not enforced here):
   * - Debit: Cash/Bank
   * - Credit: Accounts Receivable
   */
  journal: ReadonlyArray<SettlementJournalLine>;
};

/**
 * Reverses a prior settlement posting event in an audit-safe manner.
 *
 * Important:
 * - Reversal is its own legal fact (append-only).
 * - No deletion, no mutation.
 */
export type ARLedgerPostingReversed = SettlementEventBase & {
  eventType: 'AR_LEDGER_POSTING_REVERSED';

  /**
   * The original settlement event being reversed.
   * Must reference a prior AR_INVOICE_POSTED_TO_LEDGER or AR_PAYMENT_POSTED_TO_LEDGER eventId.
   */
  originalSettlementEventId: string;

  /**
   * Ledger posting reference that was reversed (or reversal batch id).
   * This keeps a tight audit chain between settlement and ledger postings.
   */
  ledgerBatchId: string;

  /**
   * Deterministic reversal journal lines.
   * Convention: exact mirror of original journal, directions swapped.
   */
  reversalJournal: ReadonlyArray<SettlementJournalLine>;
};

export type ARLedgerSettlementEvent =
  | ARInvoicePostedToLedger
  | ARPaymentPostedToLedger
  | ARLedgerPostingReversed;

/**
 * Exhaustiveness helper for switch(event.eventType).
 * Use in handlers to guarantee compile-time coverage.
 */
export function assertNever(x: never, msg?: string): never {
  throw new Error(msg ?? `Unhandled settlement event: ${String(x)}`);
}
