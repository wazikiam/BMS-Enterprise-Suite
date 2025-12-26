// packages/core/src/ap/APInvoiceEvent.ts
// AP INVOICE EVENT CONTRACT (CORE)
// PHASE 6 — STEP 1
//
// Non-negotiables:
// - Event-sourced, append-only
// - AP invoices are legal facts (not balances)
// - No CRUD accounting
// - Read models derived ONLY from events
// - Compile-time exhaustiveness

export type APInvoiceId = string;
export type SupplierId = string;
export type CurrencyCode = string;

/**
 * Monetary amount in minor units (integer) to ensure determinism.
 * Example: cents for EUR/USD, centimes for MAD, etc.
 */
export type MoneyMinor = {
  amountMinor: number;
  currency: CurrencyCode;
};

export type APInvoiceLine = {
  lineId: string;
  description: string;
  quantity: number;
  unitPriceMinor: MoneyMinor;
  taxCode?: string;
};

export type APInvoiceEventBase = {
  eventId: string;
  invoiceId: APInvoiceId;
  eventType: APInvoiceEventType;

  occurredAt: string; // ISO-8601 UTC
  actorId: string;
  actorRoles: readonly string[];

  reason: string;
  idempotencyKey: string;
};

export type APInvoiceEventType =
  | 'AP_INVOICE_ISSUED'
  | 'AP_INVOICE_UPDATED_METADATA'
  | 'AP_INVOICE_VOIDED';

export type APInvoiceIssued = APInvoiceEventBase & {
  eventType: 'AP_INVOICE_ISSUED';

  supplierId: SupplierId;

  supplierInvoiceNumber: string; // supplier's reference number
  invoiceDate: string; // YYYY-MM-DD (supplier document date)
  dueDate: string; // YYYY-MM-DD

  currency: CurrencyCode;

  lines: readonly APInvoiceLine[];

  /**
   * Totals are stored explicitly for audit and deterministic reads.
   * Must match lines at the application layer.
   */
  subtotalMinor: MoneyMinor;
  taxTotalMinor: MoneyMinor;
  totalMinor: MoneyMinor;

  notes?: string;
};

export type APInvoiceUpdatedMetadata = APInvoiceEventBase & {
  eventType: 'AP_INVOICE_UPDATED_METADATA';

  /**
   * Metadata updates only:
   * - notes
   * - supplierInvoiceNumber
   * - dueDate
   *
   * Lines and totals are NOT mutated here.
   * Any changes to economic substance require reversal + re-issue (future governed path).
   */
  supplierInvoiceNumber?: string;
  dueDate?: string;
  notes?: string;
};

export type APInvoiceVoided = APInvoiceEventBase & {
  eventType: 'AP_INVOICE_VOIDED';

  voidReason: string;
};

export type APInvoiceEvent =
  | APInvoiceIssued
  | APInvoiceUpdatedMetadata
  | APInvoiceVoided;

export function assertNever(x: never): never {
  throw new Error(`Unhandled APInvoiceEvent: ${JSON.stringify(x)}`);
}
