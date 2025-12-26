// packages/server/src/ap/APPaymentCommandHandlers.ts
// AP Payment Command Handlers (SERVER)
//
// PHASE 6 — STEP 10 (HANDLERS ONLY)
//
// Contract:
// - Commands express intent; events are legal facts
// - Append-only: handlers only APPEND events (no updates/deletes)
// - PostgreSQL authoritative via PostgresAPPaymentEventRepository
// - Period gating MUST be enforced
// - Idempotency MUST be enforced (idempotencyKey uniqueness)

import { randomUUID } from 'crypto';

import type {
  APPaymentCommand,
  RecordAPPayment,
  AllocateAPPaymentToInvoice,
  UnallocateAPPaymentFromInvoice,
  ReverseAPPayment,
} from '@bms/core/src/ap/APPaymentCommand';

import type {
  APPaymentEvent,
  APPaymentRecorded,
  APPaymentAllocatedToInvoice,
  APPaymentUnallocatedFromInvoice,
  APPaymentReversed,
} from '@bms/core/src/ap/APPaymentEvent';

import {
  PostgresAPPaymentEventRepository,
  APPaymentEventRecord,
} from './PostgresAPPaymentEventRepository';

export type APPaymentWriteResult =
  | { kind: 'APPENDED'; event: APPaymentEvent }
  | { kind: 'IDEMPOTENT_REPLAY'; event: APPaymentEvent };

export type PeriodGate = {
  /**
   * Must throw if posting is not allowed:
   * - period not found
   * - period closed
   * - legal hold active
   */
  assertPostingAllowed(input: {
    accountingDate: string; // YYYY-MM-DD
    actorId: string;
    actorRoles: readonly string[];
    reason: string;
  }): Promise<void>;
};

export class APPaymentCommandHandlers {
  constructor(
    private readonly repo: PostgresAPPaymentEventRepository,
    private readonly periodGate: PeriodGate
  ) {}

  async handle(command: APPaymentCommand): Promise<APPaymentWriteResult> {
    // Idempotency first
    const existing = await this.repo.findByIdempotencyKey(command.idempotencyKey);
    if (existing) {
      return {
        kind: 'IDEMPOTENT_REPLAY',
        event: existing.payloadJson as APPaymentEvent,
      };
    }

    // Period gating
    await this.periodGate.assertPostingAllowed({
      accountingDate: command.accountingDate,
      actorId: command.actorId,
      actorRoles: command.actorRoles,
      reason: command.reason,
    });

    switch (command.commandType) {
      case 'RECORD_AP_PAYMENT':
        return this.record(command);

      case 'ALLOCATE_AP_PAYMENT_TO_INVOICE':
        return this.allocate(command);

      case 'UNALLOCATE_AP_PAYMENT_FROM_INVOICE':
        return this.unallocate(command);

      case 'REVERSE_AP_PAYMENT':
        return this.reverse(command);

      default:
        return assertNever(command);
    }
  }

  private async record(cmd: RecordAPPayment): Promise<APPaymentWriteResult> {
    const event: APPaymentRecorded = {
      eventId: randomUUID(),
      paymentId: cmd.paymentId,
      eventType: 'AP_PAYMENT_RECORDED',

      occurredAt: new Date().toISOString(),
      actorId: cmd.actorId,
      actorRoles: cmd.actorRoles,

      reason: cmd.reason,
      idempotencyKey: cmd.idempotencyKey,

      supplierId: cmd.supplierId,
      amountMinor: cmd.amountMinor,
      method: cmd.method,
      reference: cmd.reference,
      notes: cmd.notes,
    };

    await this.repo.append(toRecord(event));
    return { kind: 'APPENDED', event };
  }

  private async allocate(
    cmd: AllocateAPPaymentToInvoice
  ): Promise<APPaymentWriteResult> {
    const event: APPaymentAllocatedToInvoice = {
      eventId: randomUUID(),
      paymentId: cmd.paymentId,
      eventType: 'AP_PAYMENT_ALLOCATED_TO_INVOICE',

      occurredAt: new Date().toISOString(),
      actorId: cmd.actorId,
      actorRoles: cmd.actorRoles,

      reason: cmd.reason,
      idempotencyKey: cmd.idempotencyKey,

      invoiceId: cmd.invoiceId,
      allocationMinor: cmd.allocationMinor,
    };

    await this.repo.append(toRecord(event));
    return { kind: 'APPENDED', event };
  }

  private async unallocate(
    cmd: UnallocateAPPaymentFromInvoice
  ): Promise<APPaymentWriteResult> {
    const event: APPaymentUnallocatedFromInvoice = {
      eventId: randomUUID(),
      paymentId: cmd.paymentId,
      eventType: 'AP_PAYMENT_UNALLOCATED_FROM_INVOICE',

      occurredAt: new Date().toISOString(),
      actorId: cmd.actorId,
      actorRoles: cmd.actorRoles,

      reason: cmd.reason,
      idempotencyKey: cmd.idempotencyKey,

      invoiceId: cmd.invoiceId,
      unallocationMinor: cmd.unallocationMinor,
      originalAllocationEventId: cmd.originalAllocationEventId,
    };

    await this.repo.append(toRecord(event));
    return { kind: 'APPENDED', event };
  }

  private async reverse(cmd: ReverseAPPayment): Promise<APPaymentWriteResult> {
    const event: APPaymentReversed = {
      eventId: randomUUID(),
      paymentId: cmd.paymentId,
      eventType: 'AP_PAYMENT_REVERSED',

      occurredAt: new Date().toISOString(),
      actorId: cmd.actorId,
      actorRoles: cmd.actorRoles,

      reason: cmd.reason,
      idempotencyKey: cmd.idempotencyKey,

      reversalReason: cmd.reversalReason,
    };

    await this.repo.append(toRecord(event));
    return { kind: 'APPENDED', event };
  }
}

function toRecord(event: APPaymentEvent): APPaymentEventRecord {
  return {
    eventId: event.eventId,
    paymentId: event.paymentId,
    eventType: event.eventType,

    actorId: event.actorId,
    actorRoles: event.actorRoles,

    reason: event.reason,
    idempotencyKey: event.idempotencyKey,

    occurredAt: event.occurredAt,

    payloadJson: event as unknown,
  };
}

export function assertNever(x: never): never {
  throw new Error(`Unhandled APPaymentCommand: ${JSON.stringify(x)}`);
}
