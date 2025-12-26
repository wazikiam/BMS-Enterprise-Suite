// packages/core/src/ar/payments/ARPaymentEvents.ts
//
// BMS Enterprise Suite — Accounts Receivable (AR)
// Phase 4.3 — AR Payments
//
// STEP 1 — EVENT CONTRACT ONLY
// - Union types only
// - No business logic
// - No persistence
// - Audit-first, append-only
// - Compile-time exhaustiveness
//
// LOCKED ARCHITECTURE:
// - AR Payments are a NEW aggregate (ARPayment)
// - Payments are independent legal facts
// - Invoices NEVER own money
// - Payments apply to invoices, not vice versa
// - No balance mutation in contracts

/* ---------------------------------------------
 * Event Type Registry
 * ------------------------------------------- */

export type ARPaymentEventType =
  | 'ARPaymentCreated'
  | 'ARPaymentVoided'
  | 'ARPaymentAppliedToInvoice'
  | 'ARPaymentUnappliedFromInvoice'
  | 'ARPaymentExternalReferenceLinked'
  | 'ARPaymentExternalReferenceUnlinked'
  | 'ARPaymentMemoUpdated';

/* ---------------------------------------------
 * Supporting Enums (as unions)
 * ------------------------------------------- */

export type ARPaymentMethod =
  | 'CASH'
  | 'CARD'
  | 'BANK_TRANSFER'
  | 'CHECK'
  | 'MOBILE_MONEY'
  | 'OTHER';

export type ARPaymentAllocationMethod =
  | 'MANUAL'
  | 'AUTO'
  | 'WRITE_OFF'
  | 'ADJUSTMENT'
  | 'REFUND';

/* ---------------------------------------------
 * Base Event Envelope (Audit-Grade)
 * ------------------------------------------- */

export type ARPaymentEventBase<TType extends ARPaymentEventType> = Readonly<{
  eventId: string; // UUID
  eventType: TType;

  // Aggregate identity
  paymentId: string; // UUID

  // Governance / audit
  actorId: string;
  actorRoles: readonly string[];
  reason: string;
  eventTime: string; // ISO-8601

  // Correlation (metadata only)
  idempotencyKey?: string;
  correlationId?: string;
  causationId?: string;

  schemaVersion: 1;
}>;

/* ---------------------------------------------
 * Event Definitions
 * ------------------------------------------- */

export type ARPaymentCreated =
  ARPaymentEventBase<'ARPaymentCreated'> &
    Readonly<{
      customerId: string; // UUID

      amountMinor: number; // integer, minor units
      currency: string; // ISO 4217

      paymentDate: string; // ISO-8601 (business date)

      method: ARPaymentMethod;

      reference?: string;
      receivedToAccountId?: string; // UUID (cash/bank account)
    }>;

export type ARPaymentVoided =
  ARPaymentEventBase<'ARPaymentVoided'> &
    Readonly<{
      voidedAt: string; // ISO-8601
      voidReason: string;
    }>;

export type ARPaymentAppliedToInvoice =
  ARPaymentEventBase<'ARPaymentAppliedToInvoice'> &
    Readonly<{
      invoiceId: string; // UUID
      appliedAmountMinor: number;
      currency: string;

      allocationMethod: ARPaymentAllocationMethod;

      appliedDate?: string; // ISO-8601
      memo?: string;
    }>;

export type ARPaymentUnappliedFromInvoice =
  ARPaymentEventBase<'ARPaymentUnappliedFromInvoice'> &
    Readonly<{
      invoiceId: string; // UUID
      unappliedAmountMinor: number;
      currency: string;

      allocationMethod: ARPaymentAllocationMethod;

      unappliedDate?: string; // ISO-8601
      memo?: string;
    }>;

export type ARPaymentExternalReferenceLinked =
  ARPaymentEventBase<'ARPaymentExternalReferenceLinked'> &
    Readonly<{
      system: string; // e.g. BANK, STRIPE
      externalReference: string;
      note?: string;
    }>;

export type ARPaymentExternalReferenceUnlinked =
  ARPaymentEventBase<'ARPaymentExternalReferenceUnlinked'> &
    Readonly<{
      system: string;
      externalReference: string;
      note?: string;
    }>;

export type ARPaymentMemoUpdated =
  ARPaymentEventBase<'ARPaymentMemoUpdated'> &
    Readonly<{
      memo: string;
    }>;

/* ---------------------------------------------
 * Discriminated Union
 * ------------------------------------------- */

export type ARPaymentEvent =
  | ARPaymentCreated
  | ARPaymentVoided
  | ARPaymentAppliedToInvoice
  | ARPaymentUnappliedFromInvoice
  | ARPaymentExternalReferenceLinked
  | ARPaymentExternalReferenceUnlinked
  | ARPaymentMemoUpdated;

/* ---------------------------------------------
 * Exhaustiveness Guard
 * ------------------------------------------- */

export function assertNever(x: never): never {
  throw new Error(`Unhandled ARPaymentEvent: ${JSON.stringify(x)}`);
}
