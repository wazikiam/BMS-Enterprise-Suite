// packages/server/src/ar/ARInvoiceCommandService.ts
// ACCOUNTS RECEIVABLE — INVOICE COMMAND SERVICE
//
// Phase 3.3: Command handling + persistence
//
// Characteristics:
// - Event-sourced
// - Append-only
// - Deterministic
// - Internal-only
// - Ledger integration on ISSUE only

import crypto from 'crypto';
import { Pool } from 'pg';

import {
  ARInvoiceEvent,
  ARInvoiceStatus,
  applyARInvoiceEvent,
  CreateARInvoiceCommand,
  IssueARInvoiceCommand,
  VoidARInvoiceCommand,
} from '@bms/core/src/ar/AccountsReceivable';

import { PostgresARInvoiceEventRepository } from './PostgresARInvoiceEventRepository';
import { ARLedgerIntegrationService } from './ARLedgerIntegrationService';
import { LedgerWriteActor } from '@bms/core/src/ledger/LedgerWriteGateway';

export class ARInvoiceCommandService {
  private readonly repo: PostgresARInvoiceEventRepository;
  private readonly ledgerIntegration: ARLedgerIntegrationService;

  constructor(private readonly pool: Pool) {
    this.repo = new PostgresARInvoiceEventRepository(pool);
    this.ledgerIntegration = new ARLedgerIntegrationService(pool);
  }

  // ─────────────────────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────────────────────

  async createInvoice(
    cmd: CreateARInvoiceCommand,
    actor: LedgerWriteActor
  ): Promise<void> {
    const event: ARInvoiceEvent = {
      type: 'AR_INVOICE_CREATED',
      invoiceId: cmd.invoiceId,
      customerId: cmd.customerId,
      currency: cmd.currency,
      totalAmount: this.computeTotal(cmd.lines),
      occurredAt: new Date(),
    };

    await this.appendEvent(cmd.invoiceId, event, actor, 'Invoice created');
  }

  // ─────────────────────────────────────────────────────────────
  // ISSUE
  // ─────────────────────────────────────────────────────────────

  async issueInvoice(
    cmd: IssueARInvoiceCommand,
    context: {
      totalAmount: string;
      currency: string;
    },
    actor: LedgerWriteActor
  ): Promise<void> {
    const state = await this.loadState(cmd.invoiceId);

    if (state.status !== ARInvoiceStatus.DRAFT) {
      throw new Error('Only DRAFT invoices can be issued');
    }

    const event: ARInvoiceEvent = {
      type: 'AR_INVOICE_ISSUED',
      invoiceId: cmd.invoiceId,
      issuedAt: cmd.issuedAt,
      occurredAt: new Date(),
    };

    await this.appendEvent(
      cmd.invoiceId,
      event,
      actor,
      'Invoice issued'
    );

    // Ledger side-effect (explicit, deterministic)
    await this.ledgerIntegration.applyIssuedInvoice(
      event,
      context,
      actor
    );
  }

  // ─────────────────────────────────────────────────────────────
  // VOID
  // ─────────────────────────────────────────────────────────────

  async voidInvoice(
    cmd: VoidARInvoiceCommand,
    actor: LedgerWriteActor
  ): Promise<void> {
    const state = await this.loadState(cmd.invoiceId);

    if (state.status === ARInvoiceStatus.VOIDED) {
      throw new Error('Invoice already voided');
    }

    const event: ARInvoiceEvent = {
      type: 'AR_INVOICE_VOIDED',
      invoiceId: cmd.invoiceId,
      reason: cmd.reason,
      occurredAt: new Date(),
    };

    await this.appendEvent(
      cmd.invoiceId,
      event,
      actor,
      'Invoice voided'
    );
  }

  // ─────────────────────────────────────────────────────────────
  // INTERNAL HELPERS
  // ─────────────────────────────────────────────────────────────

  private async loadState(invoiceId: string) {
    const events = await this.repo.listByInvoice(invoiceId);

    return events.reduce(
      (state, event) => applyARInvoiceEvent(state, event),
      undefined as any
    );
  }

  private async appendEvent(
    invoiceId: string,
    event: ARInvoiceEvent,
    actor: LedgerWriteActor,
    reason: string
  ): Promise<void> {
    const eventId = crypto
      .randomUUID();

    await this.repo.append(
      eventId,
      invoiceId,
      event,
      {
        actorId: actor.actorId,
        actorRoles: actor.roles,
      },
      reason
    );
  }

  private computeTotal(
    lines: CreateARInvoiceCommand['lines']
  ): string {
    const total = lines.reduce((sum, line) => {
      return sum + Number(line.lineTotal);
    }, 0);

    if (Number.isNaN(total) || total <= 0) {
      throw new Error('Invalid invoice total');
    }

    return total.toFixed(2);
  }
}
