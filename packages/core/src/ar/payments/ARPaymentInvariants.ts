// packages/core/src/ar/payments/ARPaymentInvariants.ts
//
// BMS Enterprise Suite — Accounts Receivable (AR)
// Phase 4.3 — AR Payments
//
// STEP 5 — DOMAIN INVARIANTS (PURE)
// - Enforce legal / accounting correctness
// - No persistence
// - No side effects
// - No mutation
// - No cross-aggregate reads
//
// Invariants THROW on violation.
// They do NOT return values.

import {
  ARPaymentCommand,
  CreateARPayment,
  VoidARPayment,
  ApplyARPaymentToInvoice,
  UnapplyARPaymentFromInvoice,
} from './ARPaymentCommands';

import { ARPaymentState } from './ARPaymentAggregate';

/* ---------------------------------------------
 * Invariant Enforcement
 * ------------------------------------------- */

export function enforceARPaymentInvariants(
  state: ARPaymentState,
  command: ARPaymentCommand,
): void {
  switch (command.commandType) {
    case 'CreateARPayment': {
      const c = command as CreateARPayment;

      if (state.paymentId) {
        throw new Error('ARPayment already exists');
      }

      if (c.amountMinor <= 0) {
        throw new Error('ARPayment amount must be greater than zero');
      }

      return;
    }

    case 'VoidARPayment': {
      const _ = command as VoidARPayment;

      if (!state.paymentId) {
        throw new Error('ARPayment does not exist');
      }

      if (state.voided) {
        throw new Error('ARPayment already voided');
      }

      return;
    }

    case 'ApplyARPaymentToInvoice': {
      const c = command as ApplyARPaymentToInvoice;

      if (state.voided) {
        throw new Error('Cannot apply a voided payment');
      }

      if (c.amountMinor <= 0) {
        throw new Error('Applied amount must be greater than zero');
      }

      if (state.appliedTotalMinor + c.amountMinor > state.amountMinor) {
        throw new Error('Applied amount exceeds payment total');
      }

      return;
    }

    case 'UnapplyARPaymentFromInvoice': {
      const c = command as UnapplyARPaymentFromInvoice;

      if (state.voided) {
        throw new Error('Cannot unapply a voided payment');
      }

      if (c.amountMinor <= 0) {
        throw new Error('Unapplied amount must be greater than zero');
      }

      if (state.appliedTotalMinor - c.amountMinor < 0) {
        throw new Error('Unapplied amount exceeds applied total');
      }

      return;
    }

    default:
      // Other commands have no invariants at this level
      return;
  }
}
