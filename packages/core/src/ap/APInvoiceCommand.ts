// packages/core/src/ap/APInvoiceCommand.ts
// AP INVOICE COMMAND CONTRACT (CORE)
// PHASE 6 — STEP 2
//
// Commands express intent. Events are the legal facts.
// Non-negotiables:
// - Idempotency required on every command
// - Period-aware intent via accountingDate (YYYY-MM-DD)
// - Compile-time exhaustiveness

import { APInvoiceId, SupplierId, CurrencyCode, MoneyMinor, APInvoiceLine } from './APInvoiceEvent';

export type APInvoiceCommandType =
  | 'ISSUE_AP_INVOICE'
  | 'UPDATE_AP_INVOICE_METADATA'
  | 'VOID_AP_INVOICE';

export type APInvoiceCommandBase = {
  commandType: APInvoiceCommandType;

  actorId: string;
  actorRoles: readonly string[];

  reason: string;
  idempotencyKey: string;

  /**
   * Period-aware write intent (posting/recognition date).
   * Even if supplier invoice date differs, accountingDate is the controlled book date.
   */
  accountingDate: string; // YYYY-MM-DD
};

export type IssueAPInvoice = APInvoiceCommandBase & {
  commandType: 'ISSUE_AP_INVOICE';

  invoiceId: APInvoiceId;
  supplierId: SupplierId;

  supplierInvoiceNumber: string;
  invoiceDate: string; // YYYY-MM-DD (supplier document date)
  dueDate: string; // YYYY-MM-DD

  currency: CurrencyCode;

  lines: readonly APInvoiceLine[];

  subtotalMinor: MoneyMinor;
  taxTotalMinor: MoneyMinor;
  totalMinor: MoneyMinor;

  notes?: string;
};

export type UpdateAPInvoiceMetadata = APInvoiceCommandBase & {
  commandType: 'UPDATE_AP_INVOICE_METADATA';

  invoiceId: APInvoiceId;

  supplierInvoiceNumber?: string;
  dueDate?: string;
  notes?: string;
};

export type VoidAPInvoice = APInvoiceCommandBase & {
  commandType: 'VOID_AP_INVOICE';

  invoiceId: APInvoiceId;
  voidReason: string;
};

export type APInvoiceCommand =
  | IssueAPInvoice
  | UpdateAPInvoiceMetadata
  | VoidAPInvoice;

export function assertNever(x: never): never {
  throw new Error(`Unhandled APInvoiceCommand: ${JSON.stringify(x)}`);
}
