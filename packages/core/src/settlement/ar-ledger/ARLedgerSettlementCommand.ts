// packages/core/src/settlement/ar-ledger/ARLedgerSettlementCommand.ts
//
// PHASE 5 (Ledger Settlement) — STEP 2 (COMMAND CONTRACT ONLY)
//
// Purpose:
// - Define the ONLY allowed write-intents (commands) for AR → Ledger settlement.
// - Compile-time exhaustiveness for command handling.
// - No handlers, no persistence, no SQL, no side effects.
//
// Non-negotiables:
// - PostgreSQL authoritative (server boundary)
// - Event-sourced, append-only, audit-grade
// - Invoices never own money; payments are independent legal facts
// - Ledger is system of record; settlement is a controlled bridge
// - Commands express intent; events express legal facts

export type ARLedgerSettlementCommandType =
  | 'POST_AR_INVOICE_TO_LEDGER'
  | 'POST_AR_PAYMENT_TO_LEDGER'
  | 'REVERSE_AR_LEDGER_POSTING';

export const AR_LEDGER_SETTLEMENT_COMMAND_TYPES: ReadonlyArray<ARLedgerSettlementCommandType> = [
  'POST_AR_INVOICE_TO_LEDGER',
  'POST_AR_PAYMENT_TO_LEDGER',
  'REVERSE_AR_LEDGER_POSTING',
] as const;

/**
 * Shared base fields for all settlement commands.
 * - occurredAt is NOT a command field (commands are intents; events record time)
 * - actor fields are required for governance enforcement at boundaries
 */
export type SettlementCommandBase = {
  commandId: string; // uuid (unique per command)
  commandType: ARLedgerSettlementCommandType;

  actorId: string;
  actorRoles: ReadonlyArray<string>;
  reason: string;

  /**
   * Mandatory idempotency key at command boundary.
   * The server must enforce uniqueness for the relevant scope.
   */
  idempotencyKey: string;

  /**
   * Target financial period constraints (period gating).
   * The server must ensure the target period is OPEN and not under LEGAL HOLD.
   *
   * Rule:
   * - Settlement is posted "as of" an accounting date.
   */
  accountingDate: string; // YYYY-MM-DD (ISO date)
};

/**
 * Command: Post an AR Invoice into the Ledger.
 *
 * Intent:
 * - Invoice issued → Revenue + Accounts Receivable
 *
 * Determinism:
 * - The server must derive the journal from AR invoice events and configured posting policy.
 * - This command must map to exactly one AR_INVOICE_POSTED_TO_LEDGER event.
 */
export type PostARInvoiceToLedger = SettlementCommandBase & {
  commandType: 'POST_AR_INVOICE_TO_LEDGER';

  invoiceId: string; // uuid
};

/**
 * Command: Post an AR Payment into the Ledger.
 *
 * Intent:
 * - Payment received → Cash/Bank + Accounts Receivable
 *
 * Determinism:
 * - The server must derive the journal from AR payment events and configured posting policy.
 * - This command must map to exactly one AR_PAYMENT_POSTED_TO_LEDGER event.
 */
export type PostARPaymentToLedger = SettlementCommandBase & {
  commandType: 'POST_AR_PAYMENT_TO_LEDGER';

  paymentId: string; // uuid
};

/**
 * Command: Reverse a prior settlement posting.
 *
 * Intent:
 * - Create a compensating entry that reverses a prior settlement event
 *
 * Determinism:
 * - Must map to exactly one AR_LEDGER_POSTING_REVERSED event.
 * - Server must validate the referenced settlement event exists and is reversible.
 */
export type ReverseARLedgerPosting = SettlementCommandBase & {
  commandType: 'REVERSE_AR_LEDGER_POSTING';

  /**
   * References the prior settlement EVENT being reversed (not a command).
   * This keeps reversals anchored to legal facts.
   */
  originalSettlementEventId: string;
};

export type ARLedgerSettlementCommand =
  | PostARInvoiceToLedger
  | PostARPaymentToLedger
  | ReverseARLedgerPosting;

/**
 * Exhaustiveness helper for switch(command.commandType).
 */
export function assertNever(x: never, msg?: string): never {
  throw new Error(msg ?? `Unhandled settlement command: ${String(x)}`);
}
