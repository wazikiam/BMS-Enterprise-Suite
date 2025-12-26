// packages/core/src/ap/APPaymentCommand.ts
// AP PAYMENT COMMAND CONTRACT (CORE)
// PHASE 6 — STEP 7
//
// Commands express intent. Events are the legal facts.
// Non-negotiables:
// - Idempotency required on every command
// - Period-aware intent via accountingDate (YYYY-MM-DD)
// - Compile-time exhaustiveness

import type { APPaymentId, SupplierId, APInvoiceId, MoneyMinor } from './APPaymentEvent';

export type APPaymentCommandType =
  | 'RECORD_AP_PAYMENT'
  | 'ALLOCATE_AP_PAYMENT_TO_INVOICE'
  | 'UNALLOCATE_AP_PAYMENT_FROM_INVOICE'
  | 'REVERSE_AP_PAYMENT';

export type APPaymentCommandBase = {
  commandType: APPaymentCommandType;

  actorId: string;
  actorRoles: readonly string[];

  reason: string;
  idempotencyKey: string;

  accountingDate: string; // YYYY-MM-DD
};

export type RecordAPPayment = APPaymentCommandBase & {
  commandType: 'RECORD_AP_PAYMENT';

  paymentId: APPaymentId;
  supplierId: SupplierId;

  amountMinor: MoneyMinor;

  method: string;
  reference?: string;
  notes?: string;
};

export type AllocateAPPaymentToInvoice = APPaymentCommandBase & {
  commandType: 'ALLOCATE_AP_PAYMENT_TO_INVOICE';

  paymentId: APPaymentId;
  invoiceId: APInvoiceId;

  allocationMinor: MoneyMinor;
};

export type UnallocateAPPaymentFromInvoice = APPaymentCommandBase & {
  commandType: 'UNALLOCATE_AP_PAYMENT_FROM_INVOICE';

  paymentId: APPaymentId;
  invoiceId: APInvoiceId;

  unallocationMinor: MoneyMinor;

  originalAllocationEventId: string;
};

export type ReverseAPPayment = APPaymentCommandBase & {
  commandType: 'REVERSE_AP_PAYMENT';

  paymentId: APPaymentId;
  reversalReason: string;
};

export type APPaymentCommand =
  | RecordAPPayment
  | AllocateAPPaymentToInvoice
  | UnallocateAPPaymentFromInvoice
  | ReverseAPPayment;

export function assertNever(x: never): never {
  throw new Error(`Unhandled APPaymentCommand: ${JSON.stringify(x)}`);
}
