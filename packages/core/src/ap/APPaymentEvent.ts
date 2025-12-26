// packages/core/src/ap/APPaymentEvent.ts
// AP PAYMENT EVENT CONTRACT (CORE)
// PHASE 6 — STEP 7
//
// Non-negotiables:
// - Event-sourced, append-only
// - Payments are independent legal facts (invoices NEVER own money)
// - No CRUD accounting
// - Read models derived ONLY from events
// - Compile-time exhaustiveness

export type APPaymentId = string;
export type SupplierId = string;
export type APInvoiceId = string;
export type CurrencyCode = string;

export type MoneyMinor = {
  amountMinor: number;
  currency: CurrencyCode;
};

export type APPaymentEventBase = {
  eventId: string;
  paymentId: APPaymentId;
  eventType: APPaymentEventType;

  occurredAt: string; // ISO-8601 UTC
  actorId: string;
  actorRoles: readonly string[];

  reason: string;
  idempotencyKey: string;
};

export type APPaymentEventType =
  | 'AP_PAYMENT_RECORDED'
  | 'AP_PAYMENT_ALLOCATED_TO_INVOICE'
  | 'AP_PAYMENT_UNALLOCATED_FROM_INVOICE'
  | 'AP_PAYMENT_REVERSED';

export type APPaymentRecorded = APPaymentEventBase & {
  eventType: 'AP_PAYMENT_RECORDED';

  supplierId: SupplierId;

  /**
   * Economic fact: amount and currency.
   * Always minor units for determinism.
   */
  amountMinor: MoneyMinor;

  /**
   * Payment instrument metadata (non-financial logic).
   * e.g. BANK_TRANSFER, CASH, CARD, CHECK
   */
  method: string;

  /**
   * External reference (bank reference, receipt number, etc.)
   */
  reference?: string;

  notes?: string;
};

export type APPaymentAllocatedToInvoice = APPaymentEventBase & {
  eventType: 'AP_PAYMENT_ALLOCATED_TO_INVOICE';

  invoiceId: APInvoiceId;
  allocationMinor: MoneyMinor;
};

export type APPaymentUnallocatedFromInvoice = APPaymentEventBase & {
  eventType: 'AP_PAYMENT_UNALLOCATED_FROM_INVOICE';

  invoiceId: APInvoiceId;
  unallocationMinor: MoneyMinor;

  originalAllocationEventId: string;
};

export type APPaymentReversed = APPaymentEventBase & {
  eventType: 'AP_PAYMENT_REVERSED';

  reversalReason: string;
};

export type APPaymentEvent =
  | APPaymentRecorded
  | APPaymentAllocatedToInvoice
  | APPaymentUnallocatedFromInvoice
  | APPaymentReversed;

export function assertNever(x: never): never {
  throw new Error(`Unhandled APPaymentEvent: ${JSON.stringify(x)}`);
}
