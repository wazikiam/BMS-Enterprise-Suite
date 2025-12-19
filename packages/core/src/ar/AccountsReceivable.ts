// packages/core/src/ar/AccountsReceivable.ts
// ACCOUNTS RECEIVABLE — CORE DOMAIN CONTRACT
//
// Governance-grade, audit-first
// Defines AR intent, NOT persistence or infrastructure
//
// Scope (Phase 1):
// - Invoice issuance
// - Deterministic state
// - Ledger integration deferred
//
// Explicitly excludes:
// - Payments
// - Credit notes
// - Accruals
// - Tax complexity

// ─────────────────────────────────────────────────────────────
// AR INVOICE STATUS
// ─────────────────────────────────────────────────────────────

export enum ARInvoiceStatus {
  DRAFT = 'DRAFT',
  ISSUED = 'ISSUED',
  VOIDED = 'VOIDED',
}

// ─────────────────────────────────────────────────────────────
// AR INVOICE LINE
// ─────────────────────────────────────────────────────────────

export interface ARInvoiceLine {
  lineId: string;
  description: string;
  quantity: number;
  unitPrice: string; // string for precision
  lineTotal: string; // quantity * unitPrice (precomputed)
  revenueAccountCode: string;
}

// ─────────────────────────────────────────────────────────────
// AR INVOICE
// ─────────────────────────────────────────────────────────────

export interface ARInvoice {
  invoiceId: string;
  customerId: string;
  currency: string;

  issuedAt?: Date;

  status: ARInvoiceStatus;
  lines: readonly ARInvoiceLine[];

  totalAmount: string;

  createdAt: Date;
}

// ─────────────────────────────────────────────────────────────
// COMMANDS (INTENT ONLY)
// ─────────────────────────────────────────────────────────────

export interface CreateARInvoiceCommand {
  invoiceId: string;
  customerId: string;
  currency: string;
  lines: readonly ARInvoiceLine[];
}

export interface IssueARInvoiceCommand {
  invoiceId: string;
  issuedAt: Date;
}

export interface VoidARInvoiceCommand {
  invoiceId: string;
  reason: string;
}

// ─────────────────────────────────────────────────────────────
// EVENTS (PURE DOMAIN EVENTS — NO LEDGER YET)
// ─────────────────────────────────────────────────────────────

export type ARInvoiceEvent =
  | {
      type: 'AR_INVOICE_CREATED';
      invoiceId: string;
      customerId: string;
      currency: string;
      totalAmount: string;
      occurredAt: Date;
    }
  | {
      type: 'AR_INVOICE_ISSUED';
      invoiceId: string;
      issuedAt: Date;
      occurredAt: Date;
    }
  | {
      type: 'AR_INVOICE_VOIDED';
      invoiceId: string;
      reason: string;
      occurredAt: Date;
    };

// ─────────────────────────────────────────────────────────────
// STATE TRANSITION CONTRACT
// ─────────────────────────────────────────────────────────────

export interface ARInvoiceState {
  invoiceId: string;
  status: ARInvoiceStatus;
  issuedAt?: Date;
  totalAmount: string;
}

/**
 * Apply AR domain events to invoice state.
 *
 * NOTE:
 * - Pure function
 * - Deterministic
 * - No side effects
 */
export function applyARInvoiceEvent(
  state: ARInvoiceState | undefined,
  event: ARInvoiceEvent
): ARInvoiceState {
  switch (event.type) {
    case 'AR_INVOICE_CREATED':
      return {
        invoiceId: event.invoiceId,
        status: ARInvoiceStatus.DRAFT,
        totalAmount: event.totalAmount,
      };

    case 'AR_INVOICE_ISSUED':
      if (!state || state.status !== ARInvoiceStatus.DRAFT) {
        throw new Error('Invoice must be in DRAFT state to be issued');
      }
      return {
        ...state,
        status: ARInvoiceStatus.ISSUED,
        issuedAt: event.issuedAt,
      };

    case 'AR_INVOICE_VOIDED':
      if (!state || state.status === ARInvoiceStatus.VOIDED) {
        throw new Error('Invoice already voided or does not exist');
      }
      return {
        ...state,
        status: ARInvoiceStatus.VOIDED,
      };

    default:
      // Exhaustiveness guard
      const _exhaustive: never = event;
      return _exhaustive;
  }
}
