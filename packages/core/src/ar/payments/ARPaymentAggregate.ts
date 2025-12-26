// packages/core/src/ar/payments/ARPaymentAggregate.ts
//
// BMS Enterprise Suite — Accounts Receivable (AR)
// Phase 4.3 — AR Payments
//
// STEP 2 — AGGREGATE STATE + REDUCER
// - Pure, deterministic
// - Event-sourced
// - No persistence
// - No balances
// - No side effects
// - Exhaustive by design

import {
  ARPaymentEvent,
  ARPaymentCreated,
  ARPaymentAppliedToInvoice,
  ARPaymentUnappliedFromInvoice,
  ARPaymentVoided,
  ARPaymentExternalReferenceLinked,
  ARPaymentExternalReferenceUnlinked,
  ARPaymentMemoUpdated,
  assertNever,
} from './ARPaymentEvents';

/* ---------------------------------------------
 * Aggregate State
 * ------------------------------------------- */

export type ARPaymentState = Readonly<{
  paymentId: string;
  customerId: string;

  amountMinor: number;
  currency: string;
  paymentDate: string;

  method: string;

  voided: boolean;

  appliedTotalMinor: number;

  applications: ReadonlyArray<{
    invoiceId: string;
    amountMinor: number;
  }>;

  externalReferences: ReadonlyArray<{
    system: string;
    reference: string;
  }>;

  memo?: string;
}>;

/* ---------------------------------------------
 * Initial State
 * ------------------------------------------- */

export const initialARPaymentState = (): ARPaymentState => ({
  paymentId: '',
  customerId: '',
  amountMinor: 0,
  currency: '',
  paymentDate: '',
  method: '',
  voided: false,
  appliedTotalMinor: 0,
  applications: [],
  externalReferences: [],
});

/* ---------------------------------------------
 * Reducer
 * ------------------------------------------- */

export function reduceARPayment(
  state: ARPaymentState,
  event: ARPaymentEvent,
): ARPaymentState {
  switch (event.eventType) {
    case 'ARPaymentCreated': {
      const e = event as ARPaymentCreated;

      return {
        ...state,
        paymentId: e.paymentId,
        customerId: e.customerId,
        amountMinor: e.amountMinor,
        currency: e.currency,
        paymentDate: e.paymentDate,
        method: e.method,
      };
    }

    case 'ARPaymentAppliedToInvoice': {
      const e = event as ARPaymentAppliedToInvoice;

      return {
        ...state,
        appliedTotalMinor: state.appliedTotalMinor + e.appliedAmountMinor,
        applications: [
          ...state.applications,
          {
            invoiceId: e.invoiceId,
            amountMinor: e.appliedAmountMinor,
          },
        ],
      };
    }

    case 'ARPaymentUnappliedFromInvoice': {
      const e = event as ARPaymentUnappliedFromInvoice;

      return {
        ...state,
        appliedTotalMinor: state.appliedTotalMinor - e.unappliedAmountMinor,
        applications: state.applications.filter(
          a =>
            !(
              a.invoiceId === e.invoiceId &&
              a.amountMinor === e.unappliedAmountMinor
            ),
        ),
      };
    }

    case 'ARPaymentExternalReferenceLinked': {
      const e = event as ARPaymentExternalReferenceLinked;

      return {
        ...state,
        externalReferences: [
          ...state.externalReferences,
          {
            system: e.system,
            reference: e.externalReference,
          },
        ],
      };
    }

    case 'ARPaymentExternalReferenceUnlinked': {
      const e = event as ARPaymentExternalReferenceUnlinked;

      return {
        ...state,
        externalReferences: state.externalReferences.filter(
          r =>
            !(
              r.system === e.system &&
              r.reference === e.externalReference
            ),
        ),
      };
    }

    case 'ARPaymentMemoUpdated': {
      const e = event as ARPaymentMemoUpdated;

      return {
        ...state,
        memo: e.memo,
      };
    }

    case 'ARPaymentVoided': {
      return {
        ...state,
        voided: true,
      };
    }

    default:
      return assertNever(event);
  }
}
