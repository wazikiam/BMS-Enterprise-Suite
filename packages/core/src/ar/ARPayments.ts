// packages/core/src/ar/ARPayments.ts
// ACCOUNTS RECEIVABLE — PAYMENTS (CORE DOMAIN)
//
// Phase 5.1
//
// - Domain-only
// - Event-sourced
// - Deterministic
// - No I/O
// - No ledger coupling
// - Governance-safe

// ─────────────────────────────────────────────────────────────
// Domain Events
// ─────────────────────────────────────────────────────────────

export type ARPaymentEvent =
  | ARPaymentReceived
  | ARPaymentAllocated
  | ARPaymentReversed;

export type ARPaymentReceived = {
  type: 'AR_PAYMENT_RECEIVED';
  paymentId: string;
  invoiceId: string;
  amount: string; // decimal as string
  currency: string;
  receivedAt: Date;
  occurredAt: Date;
};

export type ARPaymentAllocated = {
  type: 'AR_PAYMENT_ALLOCATED';
  paymentId: string;
  invoiceId: string;
  amount: string;
  allocatedAt: Date;
  occurredAt: Date;
};

export type ARPaymentReversed = {
  type: 'AR_PAYMENT_REVERSED';
  paymentId: string;
  invoiceId: string;
  reason: string;
  occurredAt: Date;
};

// ─────────────────────────────────────────────────────────────
// Domain State
// ─────────────────────────────────────────────────────────────

export type ARPaymentStatus = 'RECEIVED' | 'ALLOCATED' | 'REVERSED';

export type ARPayment = {
  paymentId: string;
  invoiceId: string;
  currency: string;
  amount: string;
  status: ARPaymentStatus;

  receivedAt: Date;
  allocatedAt?: Date;
  reversedAt?: Date;
};

// ─────────────────────────────────────────────────────────────
// Reducer
// ─────────────────────────────────────────────────────────────

export function applyARPaymentEvent(
  state: ARPayment | undefined,
  event: ARPaymentEvent
): ARPayment {
  switch (event.type) {
    case 'AR_PAYMENT_RECEIVED': {
      if (state) {
        throw new Error('Payment already exists');
      }

      return {
        paymentId: event.paymentId,
        invoiceId: event.invoiceId,
        currency: event.currency,
        amount: event.amount,
        status: 'RECEIVED',
        receivedAt: event.receivedAt,
      };
    }

    case 'AR_PAYMENT_ALLOCATED': {
      if (!state) {
        throw new Error('Payment not found');
      }
      if (state.status !== 'RECEIVED') {
        throw new Error(
          `Cannot allocate payment in status ${state.status}`
        );
      }

      return {
        ...state,
        status: 'ALLOCATED',
        allocatedAt: event.allocatedAt,
      };
    }

    case 'AR_PAYMENT_REVERSED': {
      if (!state) {
        throw new Error('Payment not found');
      }
      if (state.status === 'REVERSED') {
        throw new Error('Payment already reversed');
      }

      return {
        ...state,
        status: 'REVERSED',
        reversedAt: event.occurredAt,
      };
    }

    default: {
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }
}
