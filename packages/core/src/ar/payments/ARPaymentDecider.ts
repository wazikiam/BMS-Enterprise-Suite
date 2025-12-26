// packages/core/src/ar/payments/ARPaymentDecider.ts
//
// BMS Enterprise Suite — Accounts Receivable (AR)
// Phase 4.3 — AR Payments
//
// STEP 4 — COMMAND → EVENT DECIDER (PURE)
// - Deterministic
// - No persistence
// - No side effects
// - No validation beyond structural mapping
// - Audit-first

import {
  ARPaymentCommand,
  CreateARPayment,
  VoidARPayment,
  ApplyARPaymentToInvoice,
  UnapplyARPaymentFromInvoice,
  LinkARPaymentExternalReference,
  UnlinkARPaymentExternalReference,
  UpdateARPaymentMemo,
  assertNever as assertNeverCommand,
} from './ARPaymentCommands';

import {
  ARPaymentEvent,
  ARPaymentCreated,
  ARPaymentVoided,
  ARPaymentAppliedToInvoice,
  ARPaymentUnappliedFromInvoice,
  ARPaymentExternalReferenceLinked,
  ARPaymentExternalReferenceUnlinked,
  ARPaymentMemoUpdated,
} from './ARPaymentEvents';

import { ARPaymentState } from './ARPaymentAggregate';

/* ---------------------------------------------
 * Decider
 * ------------------------------------------- */

export function decideARPayment(
  state: ARPaymentState,
  command: ARPaymentCommand,
): readonly ARPaymentEvent[] {
  switch (command.commandType) {
    case 'CreateARPayment': {
      const c = command as CreateARPayment;

      const event: ARPaymentCreated = {
        eventId: c.commandId,
        eventType: 'ARPaymentCreated',
        paymentId: c.paymentId,

        actorId: c.actorId,
        actorRoles: c.actorRoles,
        reason: c.reason,
        eventTime: c.commandTime,

        idempotencyKey: c.idempotencyKey,
        correlationId: c.correlationId,

        schemaVersion: 1,

        customerId: c.customerId,
        amountMinor: c.amountMinor,
        currency: c.currency,
        paymentDate: c.paymentDate,
        method: c.method,
        reference: c.reference,
        receivedToAccountId: c.receivedToAccountId,
      };

      return [event];
    }

    case 'VoidARPayment': {
      const c = command as VoidARPayment;

      const event: ARPaymentVoided = {
        eventId: c.commandId,
        eventType: 'ARPaymentVoided',
        paymentId: c.paymentId,

        actorId: c.actorId,
        actorRoles: c.actorRoles,
        reason: c.reason,
        eventTime: c.commandTime,

        idempotencyKey: c.idempotencyKey,
        correlationId: c.correlationId,

        schemaVersion: 1,

        voidedAt: c.voidedAt,
        voidReason: c.voidReason,
      };

      return [event];
    }

    case 'ApplyARPaymentToInvoice': {
      const c = command as ApplyARPaymentToInvoice;

      const event: ARPaymentAppliedToInvoice = {
        eventId: c.commandId,
        eventType: 'ARPaymentAppliedToInvoice',
        paymentId: c.paymentId,

        actorId: c.actorId,
        actorRoles: c.actorRoles,
        reason: c.reason,
        eventTime: c.commandTime,

        idempotencyKey: c.idempotencyKey,
        correlationId: c.correlationId,

        schemaVersion: 1,

        invoiceId: c.invoiceId,
        appliedAmountMinor: c.amountMinor,
        currency: c.currency,
        allocationMethod: c.allocationMethod,
        appliedDate: c.appliedDate,
        memo: c.memo,
      };

      return [event];
    }

    case 'UnapplyARPaymentFromInvoice': {
      const c = command as UnapplyARPaymentFromInvoice;

      const event: ARPaymentUnappliedFromInvoice = {
        eventId: c.commandId,
        eventType: 'ARPaymentUnappliedFromInvoice',
        paymentId: c.paymentId,

        actorId: c.actorId,
        actorRoles: c.actorRoles,
        reason: c.reason,
        eventTime: c.commandTime,

        idempotencyKey: c.idempotencyKey,
        correlationId: c.correlationId,

        schemaVersion: 1,

        invoiceId: c.invoiceId,
        unappliedAmountMinor: c.amountMinor,
        currency: c.currency,
        allocationMethod: c.allocationMethod,
        unappliedDate: c.unappliedDate,
        memo: c.memo,
      };

      return [event];
    }

    case 'LinkARPaymentExternalReference': {
      const c = command as LinkARPaymentExternalReference;

      const event: ARPaymentExternalReferenceLinked = {
        eventId: c.commandId,
        eventType: 'ARPaymentExternalReferenceLinked',
        paymentId: c.paymentId,

        actorId: c.actorId,
        actorRoles: c.actorRoles,
        reason: c.reason,
        eventTime: c.commandTime,

        idempotencyKey: c.idempotencyKey,
        correlationId: c.correlationId,

        schemaVersion: 1,

        system: c.system,
        externalReference: c.externalReference,
        note: c.note,
      };

      return [event];
    }

    case 'UnlinkARPaymentExternalReference': {
      const c = command as UnlinkARPaymentExternalReference;

      const event: ARPaymentExternalReferenceUnlinked = {
        eventId: c.commandId,
        eventType: 'ARPaymentExternalReferenceUnlinked',
        paymentId: c.paymentId,

        actorId: c.actorId,
        actorRoles: c.actorRoles,
        reason: c.reason,
        eventTime: c.commandTime,

        idempotencyKey: c.idempotencyKey,
        correlationId: c.correlationId,

        schemaVersion: 1,

        system: c.system,
        externalReference: c.externalReference,
        note: c.note,
      };

      return [event];
    }

    case 'UpdateARPaymentMemo': {
      const c = command as UpdateARPaymentMemo;

      const event: ARPaymentMemoUpdated = {
        eventId: c.commandId,
        eventType: 'ARPaymentMemoUpdated',
        paymentId: c.paymentId,

        actorId: c.actorId,
        actorRoles: c.actorRoles,
        reason: c.reason,
        eventTime: c.commandTime,

        idempotencyKey: c.idempotencyKey,
        correlationId: c.correlationId,

        schemaVersion: 1,

        memo: c.memo,
      };

      return [event];
    }

    default:
      return assertNeverCommand(command);
  }
}
