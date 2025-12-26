// packages/core/src/settlement/ap-ledger/APLedgerSettlementEvent.ts
// AP → LEDGER SETTLEMENT EVENT CONTRACT (CORE)
//
// PHASE 7 — STEP 1
//
// Purpose:
// - Define the ONLY legal settlement facts that connect AP domain facts to Ledger postings
// - Deterministic, audit-grade, append-only event contract
//
// Non-negotiables:
// - No balance mutation
// - No CRUD accounting
// - Invoices NEVER own money
// - Payments are independent legal facts
// - Ledger is the system of record
// - Read models derived ONLY from events
// - Compile-time exhaustiveness

export type APLedgerSettlementId = string;
export type APInvoiceId = string;
export type APPaymentId = string;
export type SupplierId = string;
export type LedgerBatchId = string;
export type CurrencyCode = string;

export type MoneyMinor = {
  amountMinor: number;
  currency: CurrencyCode;
};

export type SettlementJournalLine = {
  accountCode: string;
  direction: 'DEBIT' | 'CREDIT';
  amountMinor: number;
  currency: CurrencyCode;
  memo?: string;
};

export type APLedgerSettlementEventType =
  | 'AP_INVOICE_POSTED_TO_LEDGER'
  | 'AP_PAYMENT_POSTED_TO_LEDGER'
  | 'AP_LEDGER_POSTING_REVERSED';

export type APLedgerSettlementEventBase = {
  eventId: string;
  settlementId: APLedgerSettlementId;
  eventType: APLedgerSettlementEventType;

  occurredAt: string; // ISO-8601 UTC

  actorId: string;
  actorRoles: readonly string[];

  reason: string;
  idempotencyKey: string;

  supplierId?: SupplierId | null;

  /**
   * Ledger batch id used to guarantee exactly-once ledger posting.
   * Deterministic, stable, and audit-traceable.
   */
  ledgerBatchId: LedgerBatchId;

  /**
   * Deterministic journal payload (minor units).
   * This is the legal posting content for audit traceability.
   */
  journal: readonly SettlementJournalLine[];
};

export type APInvoicePostedToLedger = APLedgerSettlementEventBase & {
  eventType: 'AP_INVOICE_POSTED_TO_LEDGER';

  invoiceId: APInvoiceId;

  /**
   * Economic totals (explicit for audit).
   * Must match the deterministic journal.
   */
  totalMinor: MoneyMinor;
};

export type APPaymentPostedToLedger = APLedgerSettlementEventBase & {
  eventType: 'AP_PAYMENT_POSTED_TO_LEDGER';

  paymentId: APPaymentId;

  totalMinor: MoneyMinor;
};

export type APLedgerPostingReversed = APLedgerSettlementEventBase & {
  eventType: 'AP_LEDGER_POSTING_REVERSED';

  /**
   * Which original settlement event is being reversed (legal linkage).
   */
  originalSettlementEventId: string;

  /**
   * Deterministic reversal journal payload (minor units).
   * Must reverse the original journal exactly.
   */
  reversalJournal: readonly SettlementJournalLine[];
};

export type APLedgerSettlementEvent =
  | APInvoicePostedToLedger
  | APPaymentPostedToLedger
  | APLedgerPostingReversed;

export function assertNever(x: never): never {
  throw new Error(`Unhandled APLedgerSettlementEvent: ${JSON.stringify(x)}`);
}
