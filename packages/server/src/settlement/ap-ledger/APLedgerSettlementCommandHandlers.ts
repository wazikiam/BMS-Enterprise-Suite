// packages/server/src/settlement/ap-ledger/APLedgerSettlementCommandHandlers.ts
// AP → Ledger Settlement Command Handlers (SERVER)
//
// PHASE 7 — STEP 4 (EVENTS ONLY)
//
// Contract:
// - Read AP facts from AP event stores (Postgres repositories)
// - Deterministically derive a journal (minor units)
// - Append settlement events to ap_ledger_settlement_events (Postgres repo)
// - Enforce idempotency (idempotencyKey) and period gating
// - NO ledger writes here (that is a later step)

import { randomUUID } from 'crypto';

import type { APInvoiceEvent } from '@bms/core/src/ap/APInvoiceEvent';
import type { APPaymentEvent } from '@bms/core/src/ap/APPaymentEvent';

import { APInvoiceReadModel } from '../../ap/APInvoiceReadModel';
import { APPaymentReadModel } from '../../ap/APPaymentReadModel';

import {
  APLedgerSettlementEvent,
  APInvoicePostedToLedger,
  APPaymentPostedToLedger,
  APLedgerPostingReversed,
  SettlementJournalLine,
  MoneyMinor,
} from '@bms/core/src/settlement/ap-ledger/APLedgerSettlementEvent';

import { PostgresAPInvoiceEventRepository } from '../../ap/PostgresAPInvoiceEventRepository';
import { PostgresAPPaymentEventRepository } from '../../ap/PostgresAPPaymentEventRepository';
import {
  PostgresAPLedgerSettlementEventRepository,
  APLedgerSettlementEventRecord,
} from './PostgresAPLedgerSettlementEventRepository';

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

export type LedgerBatchIdFactory = {
  /**
   * Must return a UUID string (DB column is uuid).
   * Must be deterministic for the same business fact and intent.
   */
  createForInvoicePosting(input: { invoiceId: string }): string;
  createForPaymentPosting(input: { paymentId: string }): string;
  createForReversal(input: { originalSettlementEventId: string }): string;
};

export type APLedgerAccountResolver = {
  /**
   * Returns canonical account codes for deterministic journal generation.
   * Implementation can be config-driven; handler logic stays deterministic.
   */
  apControlAccountCode(): string; // AP liability / control account
  cashOrBankAccountCode(method: string | null): string; // cash/bank based on method
  defaultExpenseAccountCode(): string; // fallback expense account for invoice postings
};

export type APLedgerSettlementWriteResult =
  | { kind: 'APPENDED'; event: APLedgerSettlementEvent }
  | { kind: 'IDEMPOTENT_REPLAY'; event: APLedgerSettlementEvent };

export type PostAPInvoiceToLedgerCommand = {
  commandType: 'POST_AP_INVOICE_TO_LEDGER';

  invoiceId: string;

  actorId: string;
  actorRoles: readonly string[];

  reason: string;
  idempotencyKey: string;

  accountingDate: string; // YYYY-MM-DD (period-gated)
};

export type PostAPPaymentToLedgerCommand = {
  commandType: 'POST_AP_PAYMENT_TO_LEDGER';

  paymentId: string;

  actorId: string;
  actorRoles: readonly string[];

  reason: string;
  idempotencyKey: string;

  accountingDate: string; // YYYY-MM-DD (period-gated)
};

/**
 * Reversal requires the original settlement payload.
 * This keeps the handler deterministic and avoids adding new DB queries in this step.
 * (We will add authoritative lookup helpers in a later step if desired.)
 */
export type ReverseAPLedgerPostingCommand = {
  commandType: 'REVERSE_AP_LEDGER_POSTING';

  originalSettlementEvent: APLedgerSettlementEvent; // authoritative original payload

  actorId: string;
  actorRoles: readonly string[];

  reason: string;
  idempotencyKey: string;

  accountingDate: string; // YYYY-MM-DD (period-gated)
};

export type APLedgerSettlementCommand =
  | PostAPInvoiceToLedgerCommand
  | PostAPPaymentToLedgerCommand
  | ReverseAPLedgerPostingCommand;

export class APLedgerSettlementCommandHandlers {
  constructor(
    private readonly settlementRepo: PostgresAPLedgerSettlementEventRepository,
    private readonly apInvoiceEvents: PostgresAPInvoiceEventRepository,
    private readonly apPaymentEvents: PostgresAPPaymentEventRepository,
    private readonly periodGate: PeriodGate,
    private readonly ledgerBatchIdFactory: LedgerBatchIdFactory,
    private readonly accounts: APLedgerAccountResolver
  ) {}

  async handle(command: APLedgerSettlementCommand): Promise<APLedgerSettlementWriteResult> {
    // Idempotency first: if already appended, return the existing legal fact.
    const existing = await this.settlementRepo.findByIdempotencyKey(command.idempotencyKey);
    if (existing) {
      return {
        kind: 'IDEMPOTENT_REPLAY',
        event: existing.payloadJson as APLedgerSettlementEvent,
      };
    }

    // Period gating enforced at write boundary.
    await this.periodGate.assertPostingAllowed({
      accountingDate: command.accountingDate,
      actorId: command.actorId,
      actorRoles: command.actorRoles,
      reason: command.reason,
    });

    switch (command.commandType) {
      case 'POST_AP_INVOICE_TO_LEDGER':
        return this.postInvoice(command);

      case 'POST_AP_PAYMENT_TO_LEDGER':
        return this.postPayment(command);

      case 'REVERSE_AP_LEDGER_POSTING':
        return this.reverse(command);

      default:
        return assertNever(command);
    }
  }

  private async postInvoice(cmd: PostAPInvoiceToLedgerCommand): Promise<APLedgerSettlementWriteResult> {
    const rows = await this.apInvoiceEvents.listByInvoiceId(cmd.invoiceId);
    const events = rows.map((r) => r.payloadJson as APInvoiceEvent);

    const view = APInvoiceReadModel.project(events);
    if (!view) {
      throw new Error(`AP invoice not found or invalid event stream: invoiceId=${cmd.invoiceId}`);
    }
    if (view.status === 'VOIDED') {
      throw new Error(`Cannot post VOIDED AP invoice to ledger: invoiceId=${cmd.invoiceId}`);
    }

    const ledgerBatchId = this.ledgerBatchIdFactory.createForInvoicePosting({
      invoiceId: cmd.invoiceId,
    });

    // Deterministic journal:
    // - DEBIT Expense (default) for total
    // - CREDIT AP Control for total
    const expense = this.accounts.defaultExpenseAccountCode();
    const apControl = this.accounts.apControlAccountCode();

    const journal: readonly SettlementJournalLine[] = Object.freeze([
      {
        accountCode: expense,
        direction: 'DEBIT',
        amountMinor: view.totalMinor,
        currency: view.currency,
        memo: `AP Invoice ${view.supplierInvoiceNumber}`,
      },
      {
        accountCode: apControl,
        direction: 'CREDIT',
        amountMinor: view.totalMinor,
        currency: view.currency,
        memo: `AP Liability ${view.supplierInvoiceNumber}`,
      },
    ]);

    const totalMinor: MoneyMinor = {
      amountMinor: view.totalMinor,
      currency: view.currency,
    };

    const event: APInvoicePostedToLedger = {
      eventId: randomUUID(),
      settlementId: cmd.invoiceId, // deterministic grouping: settlementId == invoiceId
      eventType: 'AP_INVOICE_POSTED_TO_LEDGER',

      occurredAt: new Date().toISOString(),

      actorId: cmd.actorId,
      actorRoles: cmd.actorRoles,

      reason: cmd.reason,
      idempotencyKey: cmd.idempotencyKey,

      supplierId: view.supplierId,

      ledgerBatchId,
      journal,

      invoiceId: cmd.invoiceId,
      totalMinor,
    };

    await this.settlementRepo.append(toRecord(event));
    return { kind: 'APPENDED', event };
  }

  private async postPayment(cmd: PostAPPaymentToLedgerCommand): Promise<APLedgerSettlementWriteResult> {
    const rows = await this.apPaymentEvents.listByPaymentId(cmd.paymentId);
    const events = rows.map((r) => r.payloadJson as APPaymentEvent);

    const view = APPaymentReadModel.fold(events);
    if (view.status === 'REVERSED') {
      throw new Error(`Cannot post REVERSED AP payment to ledger: paymentId=${cmd.paymentId}`);
    }

    const ledgerBatchId = this.ledgerBatchIdFactory.createForPaymentPosting({
      paymentId: cmd.paymentId,
    });

    // Deterministic journal:
    // - DEBIT AP Control for payment amount
    // - CREDIT Cash/Bank for payment amount
    const apControl = this.accounts.apControlAccountCode();
    const cashBank = this.accounts.cashOrBankAccountCode(view.method);

    const journal: readonly SettlementJournalLine[] = Object.freeze([
      {
        accountCode: apControl,
        direction: 'DEBIT',
        amountMinor: view.amountMinor,
        currency: view.currency,
        memo: `AP Payment ${cmd.paymentId}`,
      },
      {
        accountCode: cashBank,
        direction: 'CREDIT',
        amountMinor: view.amountMinor,
        currency: view.currency,
        memo: `Cash/Bank outflow`,
      },
    ]);

    const totalMinor: MoneyMinor = {
      amountMinor: view.amountMinor,
      currency: view.currency,
    };

    const event: APPaymentPostedToLedger = {
      eventId: randomUUID(),
      settlementId: cmd.paymentId, // deterministic grouping: settlementId == paymentId
      eventType: 'AP_PAYMENT_POSTED_TO_LEDGER',

      occurredAt: new Date().toISOString(),

      actorId: cmd.actorId,
      actorRoles: cmd.actorRoles,

      reason: cmd.reason,
      idempotencyKey: cmd.idempotencyKey,

      supplierId: view.supplierId,

      ledgerBatchId,
      journal,

      paymentId: cmd.paymentId,
      totalMinor,
    };

    await this.settlementRepo.append(toRecord(event));
    return { kind: 'APPENDED', event };
  }

  private async reverse(cmd: ReverseAPLedgerPostingCommand): Promise<APLedgerSettlementWriteResult> {
    const original = cmd.originalSettlementEvent;

    // Deterministic reversal journal: invert every line direction, preserve amounts/currency.
    // Type-safe: ensure direction remains the literal union 'DEBIT' | 'CREDIT'.
    const reversalJournal: readonly SettlementJournalLine[] = Object.freeze(
      original.journal.map(
        (l): SettlementJournalLine => ({
          accountCode: l.accountCode,
          direction: l.direction === 'DEBIT' ? 'CREDIT' : 'DEBIT',
          amountMinor: l.amountMinor,
          currency: l.currency,
          memo: `REVERSAL: ${l.memo ?? ''}`.trim(),
        })
      )
    );

    const ledgerBatchId = this.ledgerBatchIdFactory.createForReversal({
      originalSettlementEventId: original.eventId,
    });

    const event: APLedgerPostingReversed = {
      eventId: randomUUID(),
      settlementId: original.settlementId,
      eventType: 'AP_LEDGER_POSTING_REVERSED',

      occurredAt: new Date().toISOString(),

      actorId: cmd.actorId,
      actorRoles: cmd.actorRoles,

      reason: cmd.reason,
      idempotencyKey: cmd.idempotencyKey,

      supplierId: original.supplierId ?? null,

      ledgerBatchId,
      journal: original.journal,

      originalSettlementEventId: original.eventId,
      reversalJournal,
    };

    await this.settlementRepo.append(toRecord(event));
    return { kind: 'APPENDED', event };
  }
}

function toRecord(event: APLedgerSettlementEvent): APLedgerSettlementEventRecord {
  // Keep both explicit journal_json and reversal_journal_json for audit and queryability.
  const anyEvent = event as any;

  return {
    eventId: event.eventId,
    settlementId: event.settlementId,
    eventType: event.eventType,

    actorId: event.actorId,
    actorRoles: event.actorRoles,

    reason: event.reason,
    idempotencyKey: event.idempotencyKey,

    occurredAt: event.occurredAt,

    invoiceId: anyEvent.invoiceId ?? null,
    paymentId: anyEvent.paymentId ?? null,
    supplierId: anyEvent.supplierId ?? null,

    ledgerBatchId: event.ledgerBatchId ?? null,
    originalSettlementEventId: anyEvent.originalSettlementEventId ?? null,

    journalJson: event.journal,
    reversalJournalJson: anyEvent.reversalJournal ?? null,

    payloadJson: event as unknown,
  };
}

export function assertNever(x: never): never {
  throw new Error(`Unhandled APLedgerSettlementCommand: ${JSON.stringify(x)}`);
}
