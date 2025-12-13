// packages/core/src/services/InvoiceSettlementService.ts

import { Money } from '../domain/Invoice';

/**
 * InvoiceSettlementService (WRITE ORCHESTRATION)
 * ---------------------------------------------
 * Minimal integration seam between Payments and Invoices.
 *
 * HARD RULES:
 * - No payment math here
 * - No repository writes here
 * - Delegate invariants to InvoiceService
 */
export class InvoiceSettlementService {
  constructor(
    private invoiceService: any
  ) {}

  async applyPaymentToInvoice(input: {
    invoiceId: string;
    amount: Money;
    now?: Date;
    reference?: string;
  }): Promise<any> {
    if (!input.invoiceId) throw new Error('invoiceId is required');
    if (!input.amount) throw new Error('amount is required');
    if (typeof input.amount.amount !== 'number') throw new Error('amount.amount must be a number');
    if (!input.amount.currency) throw new Error('amount.currency is required');
    if (input.amount.amount <= 0) throw new Error('amount.amount must be > 0');

    const invoice = await this.invoiceService.applyPayment(
      input.invoiceId,
      input.amount,
      input.now ?? new Date()
    );

    return {
      invoice,
      reference: input.reference
    };
  }
}
