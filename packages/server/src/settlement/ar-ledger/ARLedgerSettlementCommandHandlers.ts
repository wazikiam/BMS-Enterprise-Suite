// packages/server/src/settlement/ar-ledger/ARLedgerSettlementCommandHandlers.ts
// AR → Ledger Settlement Command Handlers (SERVER)
//
// PHASE 5 — STEP 6 (FINAL)
//
// Contract:
// - Commands express intent; events are legal facts
// - Append-only: handlers only APPEND events (no updates/deletes)
// - PostgreSQL authoritative via PostgresARLedgerSettlementEventRepository
// - Period gating MUST be enforced
// - Idempotency MUST be enforced (idempotencyKey uniqueness)
// - Reversals MUST load original settlement event authoritatively

import { randomUUID } from 'crypto';

import {
  ARLedgerSettlementCommand,
  PostARInvoiceToLedger,
  PostARPaymentToLedger,
  ReverseARLedgerPosting,
} from '@bms/core/src/settlement/ar-ledger/ARLedgerSettlementCommand';

import {
  ARLedgerSettlementEvent,
  ARInvoicePostedToLedger,
  ARPaymentPostedToLedger,
  ARLedgerPostingReversed,
  SettlementJournalLine,
} from '@bms/core/src/settlement/ar-ledger/ARLedgerSettlementEvent';

import {
  PostgresARLedgerSettlementEventRepository,
  ARLedgerSettlementEventRecord,
} from './PostgresARLedgerSettlementEventRepository';

export type SettlementWriteResult =
  | { kind: 'APPENDED'; event: ARLedgerSettlementEvent }
  | { kind: 'IDEMPOTENT_REPLAY'; event: ARLedgerSettlementEvent };

export type PeriodGate = {
  assertPostingAllowed(input: {
    accountingDate: string;
    actorId: string;
    actorRoles: readonly string[];
    reason: string;
  }): Promise<void>;
};

export type SettlementJournalDeriver = {
  deriveInvoiceJournal(input: {
    invoiceId: string;
    accountingDate: string;
  }): Promise<{
    customerId: string;
    currency: string;
    journal: ReadonlyArray<SettlementJournalLine>;
  }>;

  derivePaymentJournal(input: {
    paymentId: string;
    accountingDate: string;
  }): Promise<{
    customerId: string;
    currency: string;
    journal: ReadonlyArray<SettlementJournalLine>;
  }>;

  deriveReversalJournal(input: {
    originalEvent: ARLedgerSettlementEvent;
  }): Promise<{
    reversalJournal: ReadonlyArray<SettlementJournalLine>;
  }>;
};

export type LedgerBatchIdFactory = {
  createForInvoicePosting(input: { settlementId: string; invoiceId: string; accountingDate: string }): string;
  createForPaymentPosting(input: { settlementId: string; paymentId: string; accountingDate: string }): string;
  createForReversal(input: {
    settlementId: string;
    originalSettlementEventId: string;
    accountingDate: string;
  }): string;
};

export class ARLedgerSettlementCommandHandlers {
  constructor(
    private readonly repo: PostgresARLedgerSettlementEventRepository,
    private readonly periodGate: PeriodGate,
    private readonly deriver: SettlementJournalDeriver,
    private readonly ledgerBatchIdFactory: LedgerBatchIdFactory
  ) {}

  async handle(command: ARLedgerSettlementCommand): Promise<SettlementWriteResult> {
    const existing = await this.repo.findByIdempotencyKey(command.idempotencyKey);
    if (existing) {
      return { kind: 'IDEMPOTENT_REPLAY', event: existing.payloadJson as ARLedgerSettlementEvent };
    }

    await this.periodGate.assertPostingAllowed({
      accountingDate: command.accountingDate,
      actorId: command.actorId,
      actorRoles: command.actorRoles,
      reason: command.reason,
    });

    switch (command.commandType) {
      case 'POST_AR_INVOICE_TO_LEDGER':
        return this.postInvoice(command);

      case 'POST_AR_PAYMENT_TO_LEDGER':
        return this.postPayment(command);

      case 'REVERSE_AR_LEDGER_POSTING':
        return this.reversePosting(command);

      default:
        return assertNever(command);
    }
  }

  private async postInvoice(cmd: PostARInvoiceToLedger): Promise<SettlementWriteResult> {
    const settlementId = randomUUID();
    const eventId = randomUUID();

    const derived = await this.deriver.deriveInvoiceJournal({
      invoiceId: cmd.invoiceId,
      accountingDate: cmd.accountingDate,
    });

    const ledgerBatchId = this.ledgerBatchIdFactory.createForInvoicePosting({
      settlementId,
      invoiceId: cmd.invoiceId,
      accountingDate: cmd.accountingDate,
    });

    const event: ARInvoicePostedToLedger = {
      eventId,
      settlementId,
      eventType: 'AR_INVOICE_POSTED_TO_LEDGER',
      occurredAt: new Date().toISOString(),
      actorId: cmd.actorId,
      actorRoles: cmd.actorRoles,
      reason: cmd.reason,
      idempotencyKey: cmd.idempotencyKey,
      invoiceId: cmd.invoiceId,
      customerId: derived.customerId,
      ledgerBatchId,
      journal: derived.journal,
    };

    await this.repo.append(toRecord(event));
    return { kind: 'APPENDED', event };
  }

  private async postPayment(cmd: PostARPaymentToLedger): Promise<SettlementWriteResult> {
    const settlementId = randomUUID();
    const eventId = randomUUID();

    const derived = await this.deriver.derivePaymentJournal({
      paymentId: cmd.paymentId,
      accountingDate: cmd.accountingDate,
    });

    const ledgerBatchId = this.ledgerBatchIdFactory.createForPaymentPosting({
      settlementId,
      paymentId: cmd.paymentId,
      accountingDate: cmd.accountingDate,
    });

    const event: ARPaymentPostedToLedger = {
      eventId,
      settlementId,
      eventType: 'AR_PAYMENT_POSTED_TO_LEDGER',
      occurredAt: new Date().toISOString(),
      actorId: cmd.actorId,
      actorRoles: cmd.actorRoles,
      reason: cmd.reason,
      idempotencyKey: cmd.idempotencyKey,
      paymentId: cmd.paymentId,
      customerId: derived.customerId,
      ledgerBatchId,
      journal: derived.journal,
    };

    await this.repo.append(toRecord(event));
    return { kind: 'APPENDED', event };
  }

  private async reversePosting(cmd: ReverseARLedgerPosting): Promise<SettlementWriteResult> {
    const originalRecord = await this.repo.findByEventId(cmd.originalSettlementEventId);
    if (!originalRecord) {
      throw new Error(`Original settlement event not found: ${cmd.originalSettlementEventId}`);
    }

    const originalEvent = originalRecord.payloadJson as ARLedgerSettlementEvent;

    const settlementId = randomUUID();
    const eventId = randomUUID();

    const derived = await this.deriver.deriveReversalJournal({ originalEvent });

    const ledgerBatchId = this.ledgerBatchIdFactory.createForReversal({
      settlementId,
      originalSettlementEventId: cmd.originalSettlementEventId,
      accountingDate: cmd.accountingDate,
    });

    const event: ARLedgerPostingReversed = {
      eventId,
      settlementId,
      eventType: 'AR_LEDGER_POSTING_REVERSED',
      occurredAt: new Date().toISOString(),
      actorId: cmd.actorId,
      actorRoles: cmd.actorRoles,
      reason: cmd.reason,
      idempotencyKey: cmd.idempotencyKey,
      originalSettlementEventId: cmd.originalSettlementEventId,
      ledgerBatchId,
      reversalJournal: derived.reversalJournal,
    };

    await this.repo.append(toRecord(event, originalEvent));
    return { kind: 'APPENDED', event };
  }
}

function toRecord(
  event: ARLedgerSettlementEvent,
  originalEventForReversal?: ARLedgerSettlementEvent
): ARLedgerSettlementEventRecord {
  const base = {
    eventId: event.eventId,
    settlementId: event.settlementId,
    eventType: event.eventType,
    actorId: event.actorId,
    actorRoles: event.actorRoles,
    reason: event.reason,
    idempotencyKey: event.idempotencyKey,
    occurredAt: event.occurredAt,
    payloadJson: event as unknown,
  };

  if (event.eventType === 'AR_INVOICE_POSTED_TO_LEDGER') {
    return {
      ...base,
      invoiceId: event.invoiceId,
      customerId: event.customerId,
      ledgerBatchId: event.ledgerBatchId,
      journalJson: event.journal,
      reversalJournalJson: null,
      paymentId: null,
      originalSettlementEventId: null,
    };
  }

  if (event.eventType === 'AR_PAYMENT_POSTED_TO_LEDGER') {
    return {
      ...base,
      paymentId: event.paymentId,
      customerId: event.customerId,
      ledgerBatchId: event.ledgerBatchId,
      journalJson: event.journal,
      reversalJournalJson: null,
      invoiceId: null,
      originalSettlementEventId: null,
    };
  }

  const reversal = event as ARLedgerPostingReversed;
  return {
    ...base,
    originalSettlementEventId: reversal.originalSettlementEventId,
    ledgerBatchId: reversal.ledgerBatchId,
    journalJson: originalEventForReversal ?? null,
    reversalJournalJson: reversal.reversalJournal,
    invoiceId: null,
    paymentId: null,
    customerId: null,
  };
}

export function assertNever(x: never): never {
  throw new Error(`Unhandled ARLedgerSettlementCommand: ${JSON.stringify(x)}`);
}
