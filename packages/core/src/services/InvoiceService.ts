// packages/core/src/services/InvoiceService.ts

import { Invoice, InvoiceId, InvoiceLine, InvoiceStatus, Money } from '../domain/Invoice';
import { IInvoiceRepository } from '../repositories/InvoiceRepository';

export interface IInvoiceNumberGenerator {
  nextInvoiceNumber(input?: { now?: Date }): Promise<string>;
}

/**
 * Week 6 service: orchestration only.
 * - Domain invariants live in Invoice aggregate.
 * - Repository abstracts persistence.
 * - Number generator abstracts sequencing (DB sequence, redis, etc).
 */
export class InvoiceService {
  constructor(
    private readonly invoiceRepo: IInvoiceRepository,
    private readonly numberGen: IInvoiceNumberGenerator
  ) {}

  async createDraft(input: {
    id: InvoiceId;
    customerId: string;
    customerName?: string;
    currency?: string;
    lines?: InvoiceLine[];
    dueAt?: Date;
    notes?: string;
    saleOrderId?: string;
    now?: Date;
  }): Promise<Invoice> {
    const invoice = Invoice.createDraft({
      id: input.id,
      parties: { customerId: input.customerId, customerName: input.customerName },
      currency: input.currency ?? 'MAD',
      lines: input.lines ?? [],
      dueAt: input.dueAt,
      notes: input.notes,
      sourceRefs: input.saleOrderId ? { saleOrderId: input.saleOrderId } : undefined,
      now: input.now,
    });

    await this.invoiceRepo.save(invoice);
    return invoice;
  }

  async addLine(invoiceId: InvoiceId, line: InvoiceLine, now: Date = new Date()): Promise<Invoice> {
    const invoice = await this.mustGet(invoiceId);
    invoice.addLine(line, now);
    await this.invoiceRepo.save(invoice);
    return invoice;
  }

  async replaceLines(invoiceId: InvoiceId, lines: InvoiceLine[], now: Date = new Date()): Promise<Invoice> {
    const invoice = await this.mustGet(invoiceId);
    invoice.replaceLines(lines, now);
    await this.invoiceRepo.save(invoice);
    return invoice;
  }

  async issue(invoiceId: InvoiceId, now: Date = new Date()): Promise<Invoice> {
    const invoice = await this.mustGet(invoiceId);
    if (invoice.status !== InvoiceStatus.DRAFT) return invoice;

    const invoiceNumber = await this.numberGen.nextInvoiceNumber({ now });
    invoice.issue({ invoiceNumber, now });

    await this.invoiceRepo.save(invoice);
    return invoice;
  }

  async cancel(invoiceId: InvoiceId, reason?: string, now: Date = new Date()): Promise<Invoice> {
    const invoice = await this.mustGet(invoiceId);
    invoice.cancel(reason, now);
    await this.invoiceRepo.save(invoice);
    return invoice;
  }

  /**
   * Payment allocation entrypoint.
   * In Week 7 you can wire this to Payments/Receivables events instead of direct calls.
   */
  async applyPayment(invoiceId: InvoiceId, amount: Money, now: Date = new Date()): Promise<Invoice> {
    const invoice = await this.mustGet(invoiceId);
    invoice.applyPayment(amount, now);
    await this.invoiceRepo.save(invoice);
    return invoice;
  }

  private async mustGet(id: InvoiceId): Promise<Invoice> {
    const invoice = await this.invoiceRepo.getById(id);
    if (!invoice) throw new Error(`Invoice not found: ${id}`);
    return invoice;
  }
}
