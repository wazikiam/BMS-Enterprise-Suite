// packages/server/src/ap/APInvoiceCommandHandlers.ts
// AP Invoice Command Handlers (SERVER)
//
// PHASE 6 — STEP 5 (HANDLERS ONLY)
//
// Contract:
// - Commands express intent; events are legal facts
// - Append-only: handlers only APPEND events (no updates/deletes)
// - PostgreSQL authoritative via PostgresAPInvoiceEventRepository
// - Period gating MUST be enforced
// - Idempotency MUST be enforced (idempotencyKey uniqueness)

import { randomUUID } from 'crypto';

import type {
  APInvoiceCommand,
  IssueAPInvoice,
  UpdateAPInvoiceMetadata,
  VoidAPInvoice,
} from '@bms/core/src/ap/APInvoiceCommand';

import type {
  APInvoiceEvent,
  APInvoiceIssued,
  APInvoiceUpdatedMetadata,
  APInvoiceVoided,
} from '@bms/core/src/ap/APInvoiceEvent';

import {
  PostgresAPInvoiceEventRepository,
  APInvoiceEventRecord,
} from './PostgresAPInvoiceEventRepository';

export type APInvoiceWriteResult =
  | { kind: 'APPENDED'; event: APInvoiceEvent }
  | { kind: 'IDEMPOTENT_REPLAY'; event: APInvoiceEvent };

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

export class APInvoiceCommandHandlers {
  constructor(
    private readonly repo: PostgresAPInvoiceEventRepository,
    private readonly periodGate: PeriodGate
  ) {}

  async handle(command: APInvoiceCommand): Promise<APInvoiceWriteResult> {
    // Idempotency first: if already appended, return the existing legal fact.
    const existing = await this.repo.findByIdempotencyKey(command.idempotencyKey);
    if (existing) {
      return { kind: 'IDEMPOTENT_REPLAY', event: existing.payloadJson as APInvoiceEvent };
    }

    // Period gating enforced at write boundary.
    await this.periodGate.assertPostingAllowed({
      accountingDate: command.accountingDate,
      actorId: command.actorId,
      actorRoles: command.actorRoles,
      reason: command.reason,
    });

    switch (command.commandType) {
      case 'ISSUE_AP_INVOICE':
        return this.issue(command);

      case 'UPDATE_AP_INVOICE_METADATA':
        return this.updateMetadata(command);

      case 'VOID_AP_INVOICE':
        return this.void(command);

      default:
        return assertNever(command);
    }
  }

  private async issue(cmd: IssueAPInvoice): Promise<APInvoiceWriteResult> {
    const event: APInvoiceIssued = {
      eventId: randomUUID(),
      invoiceId: cmd.invoiceId,
      eventType: 'AP_INVOICE_ISSUED',

      occurredAt: new Date().toISOString(),
      actorId: cmd.actorId,
      actorRoles: cmd.actorRoles,

      reason: cmd.reason,
      idempotencyKey: cmd.idempotencyKey,

      supplierId: cmd.supplierId,
      supplierInvoiceNumber: cmd.supplierInvoiceNumber,
      invoiceDate: cmd.invoiceDate,
      dueDate: cmd.dueDate,

      currency: cmd.currency,
      lines: cmd.lines,

      subtotalMinor: cmd.subtotalMinor,
      taxTotalMinor: cmd.taxTotalMinor,
      totalMinor: cmd.totalMinor,

      notes: cmd.notes,
    };

    await this.repo.append(toRecord(event));
    return { kind: 'APPENDED', event };
  }

  private async updateMetadata(cmd: UpdateAPInvoiceMetadata): Promise<APInvoiceWriteResult> {
    const event: APInvoiceUpdatedMetadata = {
      eventId: randomUUID(),
      invoiceId: cmd.invoiceId,
      eventType: 'AP_INVOICE_UPDATED_METADATA',

      occurredAt: new Date().toISOString(),
      actorId: cmd.actorId,
      actorRoles: cmd.actorRoles,

      reason: cmd.reason,
      idempotencyKey: cmd.idempotencyKey,

      supplierInvoiceNumber: cmd.supplierInvoiceNumber,
      dueDate: cmd.dueDate,
      notes: cmd.notes,
    };

    await this.repo.append(toRecord(event));
    return { kind: 'APPENDED', event };
  }

  private async void(cmd: VoidAPInvoice): Promise<APInvoiceWriteResult> {
    const event: APInvoiceVoided = {
      eventId: randomUUID(),
      invoiceId: cmd.invoiceId,
      eventType: 'AP_INVOICE_VOIDED',

      occurredAt: new Date().toISOString(),
      actorId: cmd.actorId,
      actorRoles: cmd.actorRoles,

      reason: cmd.reason,
      idempotencyKey: cmd.idempotencyKey,

      voidReason: cmd.voidReason,
    };

    await this.repo.append(toRecord(event));
    return { kind: 'APPENDED', event };
  }
}

function toRecord(event: APInvoiceEvent): APInvoiceEventRecord {
  return {
    eventId: event.eventId,
    invoiceId: event.invoiceId,
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
  throw new Error(`Unhandled APInvoiceCommand: ${JSON.stringify(x)}`);
}
