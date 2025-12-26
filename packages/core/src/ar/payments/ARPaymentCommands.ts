// packages/core/src/ar/payments/ARPaymentCommands.ts
//
// BMS Enterprise Suite — Accounts Receivable (AR)
// Phase 4.3 — AR Payments
//
// STEP 3 — COMMAND CONTRACTS (INTENT ONLY)
// - Union types only
// - No validation
// - No business logic
// - No persistence
// - Audit-first
//
// Commands express INTENT.
// Events express FACTS.
// Handlers will bridge them in later steps.

/* ---------------------------------------------
 * Command Type Registry
 * ------------------------------------------- */

export type ARPaymentCommandType =
  | 'CreateARPayment'
  | 'VoidARPayment'
  | 'ApplyARPaymentToInvoice'
  | 'UnapplyARPaymentFromInvoice'
  | 'LinkARPaymentExternalReference'
  | 'UnlinkARPaymentExternalReference'
  | 'UpdateARPaymentMemo';

/* ---------------------------------------------
 * Base Command Envelope
 * ------------------------------------------- */

export type ARPaymentCommandBase<TType extends ARPaymentCommandType> = Readonly<{
  commandId: string; // UUID
  commandType: TType;

  // Aggregate identity
  paymentId: string; // UUID

  // Governance / audit
  actorId: string;
  actorRoles: readonly string[];
  reason: string;
  commandTime: string; // ISO-8601

  idempotencyKey?: string;
  correlationId?: string;
}>;

/* ---------------------------------------------
 * Command Definitions
 * ------------------------------------------- */

export type CreateARPayment =
  ARPaymentCommandBase<'CreateARPayment'> &
    Readonly<{
      customerId: string; // UUID

      amountMinor: number;
      currency: string; // ISO 4217

      paymentDate: string; // ISO-8601
      method:
        | 'CASH'
        | 'CARD'
        | 'BANK_TRANSFER'
        | 'CHECK'
        | 'MOBILE_MONEY'
        | 'OTHER';

      reference?: string;
      receivedToAccountId?: string; // UUID
    }>;

export type VoidARPayment =
  ARPaymentCommandBase<'VoidARPayment'> &
    Readonly<{
      voidReason: string;
      voidedAt: string; // ISO-8601
    }>;

export type ApplyARPaymentToInvoice =
  ARPaymentCommandBase<'ApplyARPaymentToInvoice'> &
    Readonly<{
      invoiceId: string; // UUID
      amountMinor: number;
      currency: string;

      allocationMethod:
        | 'MANUAL'
        | 'AUTO'
        | 'WRITE_OFF'
        | 'ADJUSTMENT'
        | 'REFUND';

      appliedDate?: string; // ISO-8601
      memo?: string;
    }>;

export type UnapplyARPaymentFromInvoice =
  ARPaymentCommandBase<'UnapplyARPaymentFromInvoice'> &
    Readonly<{
      invoiceId: string; // UUID
      amountMinor: number;
      currency: string;

      allocationMethod:
        | 'MANUAL'
        | 'AUTO'
        | 'WRITE_OFF'
        | 'ADJUSTMENT'
        | 'REFUND';

      unappliedDate?: string; // ISO-8601
      memo?: string;
    }>;

export type LinkARPaymentExternalReference =
  ARPaymentCommandBase<'LinkARPaymentExternalReference'> &
    Readonly<{
      system: string;
      externalReference: string;
      note?: string;
    }>;

export type UnlinkARPaymentExternalReference =
  ARPaymentCommandBase<'UnlinkARPaymentExternalReference'> &
    Readonly<{
      system: string;
      externalReference: string;
      note?: string;
    }>;

export type UpdateARPaymentMemo =
  ARPaymentCommandBase<'UpdateARPaymentMemo'> &
    Readonly<{
      memo: string;
    }>;

/* ---------------------------------------------
 * Discriminated Union
 * ------------------------------------------- */

export type ARPaymentCommand =
  | CreateARPayment
  | VoidARPayment
  | ApplyARPaymentToInvoice
  | UnapplyARPaymentFromInvoice
  | LinkARPaymentExternalReference
  | UnlinkARPaymentExternalReference
  | UpdateARPaymentMemo;

/* ---------------------------------------------
 * Exhaustiveness Guard
 * ------------------------------------------- */

export function assertNever(x: never): never {
  throw new Error(`Unhandled ARPaymentCommand: ${JSON.stringify(x)}`);
}
