// packages/server/src/ar/ARInvoiceCommandService.ts
// COMMAND SIDE — Accounts Receivable (Invoices)
// Strict separation:
// - Commands emit business intent only
// - Repository injects audit metadata
// - Domain reducer stays pure

import { randomUUID } from 'crypto';
import {
  applyARInvoiceEvent,
  ARInvoiceEvent,
  ARInvoiceState,
} from '@bms/core/src/ar/AccountsReceivable';
import { PostgresARInvoiceEventRepository } from './PostgresARInvoiceEventRepository';
import { mapARInvoiceEvent } from './mapARInvoiceEvent';

export class ARInvoiceCommandService {
  constructor(
    private readonly repo: PostgresARInvoiceEventRepository
  ) {}

  private async loadState(
    invoiceId: string
  ): Promise<ARInvoiceState | undefined> {
    const records = await this.repo.listByInvoice(invoiceId);

    const domainEvents: ARInvoiceEvent[] =
      records.map(mapARInvoiceEvent);

    return domainEvents.reduce(
      (state, event) => applyARInvoiceEvent(state, event),
      undefined as ARInvoiceState | undefined
    );
  }

  async createInvoice(params: {
    invoiceId?: string;
    customerId: string;
    currency: string;
    totalAmount: string;
  }): Promise<string> {
    const invoiceId = params.invoiceId ?? randomUUID();

    await this.repo.append({
      eventId: randomUUID(),
      invoiceId,
      eventType: 'AR_INVOICE_CREATED',
      payload: {
        customerId: params.customerId,
        currency: params.currency,
        totalAmount: params.totalAmount,
      },
    });

    return invoiceId;
  }

  async issueInvoice(params: {
    invoiceId: string;
    issuedAt: Date;
    dueDate?: Date;
  }): Promise<void> {
    const state = await this.loadState(params.invoiceId);

    if (!state) {
      throw new Error('Invoice does not exist');
    }

    if (state.status !== 'DRAFT') {
      throw new Error('Invoice must be in DRAFT state to be issued');
    }

    await this.repo.append({
      eventId: randomUUID(),
      invoiceId: params.invoiceId,
      eventType: 'AR_INVOICE_ISSUED',
      payload: {
        issuedAt: params.issuedAt.toISOString(),
        dueDate: params.dueDate?.toISOString(),
      },
    });
  }

  async voidInvoice(params: {
    invoiceId: string;
    reason: string;
  }): Promise<void> {
    const state = await this.loadState(params.invoiceId);

    if (!state) {
      throw new Error('Invoice does not exist');
    }

    if (state.status === 'VOIDED') {
      return;
    }

    await this.repo.append({
      eventId: randomUUID(),
      invoiceId: params.invoiceId,
      eventType: 'AR_INVOICE_VOIDED',
      payload: {
        reason: params.reason,
      },
    });
  }
}
