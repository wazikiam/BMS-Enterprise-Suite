// packages/core/src/services/settlement/SettlementService.ts

import { Payment } from '../../domain/payment/Payment';
import { PaymentStatus } from '../../domain/payment/PaymentStatus';

/**
 * SettlementService
 * -----------------
 * Applies posted payments to receivables and invoices.
 *
 * Design:
 * - Deterministic
 * - Idempotent by payment.id
 * - No payment creation or mutation
 */
export class SettlementService {
  constructor(
    private invoiceRepository: any,
    private receivablesRepository: any
  ) {}

  /**
   * Apply a posted payment to invoices and AR.
   */
  settlePayment(payment: Payment): void {
    if (payment.status !== PaymentStatus.POSTED) {
      throw new Error('Only POSTED payments can be settled');
    }

    // 1. Apply to invoices (partial or full)
    for (const invoiceId of payment.appliedInvoiceIds) {
      this.applyPaymentToInvoice(invoiceId, payment);
    }

    // 2. Apply to customer receivables
    this.applyPaymentToReceivables(payment);
  }

  /* =====================================================
     INTERNALS
     ===================================================== */

  private applyPaymentToInvoice(invoiceId: string, payment: Payment): void {
    // Repository contract expectations:
    // - getById(id)
    // - applyPayment(id, amount, paymentId)
    const invoice = this.invoiceRepository.getById(invoiceId);

    if (!invoice) {
      throw new Error(`Invoice not found: ${invoiceId}`);
    }

    this.invoiceRepository.applyPayment(
      invoiceId,
      payment.amount,
      payment.id
    );
  }

  private applyPaymentToReceivables(payment: Payment): void {
    // Repository contract expectations:
    // - applyPayment(customerId, amount, paymentId)
    this.receivablesRepository.applyPayment(
      payment.id,
      payment.amount
    );
  }
}
