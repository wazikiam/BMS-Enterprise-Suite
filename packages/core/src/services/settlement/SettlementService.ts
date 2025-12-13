// packages/core/src/services/settlement/SettlementService.ts

import { Payment } from '../../domain/payment/Payment';
import { PaymentStatus } from '../../domain/payment/PaymentStatus';

/**
 * SettlementService
 * -----------------
 * Applies and rolls back posted payments against invoices and receivables.
 *
 * Principles:
 * - Deterministic
 * - Idempotent per payment.id
 * - No payment mutation
 * - No persistence assumptions beyond repository contracts
 */
export class SettlementService {
  constructor(
    private invoiceRepository: any,
    private receivablesRepository: any
  ) {}

  /* =====================================================
     APPLY
     ===================================================== */

  /**
   * Apply a POSTED payment to invoices and AR.
   */
  settlePayment(payment: Payment): void {
    if (payment.status !== PaymentStatus.POSTED) {
      throw new Error('Only POSTED payments can be settled');
    }

    // 1. Apply to invoices (partial or full)
    for (const invoiceId of payment.appliedInvoiceIds) {
      this.applyPaymentToInvoice(invoiceId, payment);
    }

    // 2. Apply to receivables
    this.applyPaymentToReceivables(payment);
  }

  private applyPaymentToInvoice(
    invoiceId: string,
    payment: Payment
  ): void {
    // Repository contract:
    // - getById(id)
    // - applyPayment(invoiceId, amount, paymentId)
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
    // Repository contract:
    // - applyPayment(paymentId, amount)
    this.receivablesRepository.applyPayment(
      payment.id,
      payment.amount
    );
  }

  /* =====================================================
     ROLLBACK
     ===================================================== */

  /**
   * Roll back the effects of a previously settled payment.
   */
  rollbackPayment(payment: Payment): void {
    if (payment.status !== PaymentStatus.REVERSED) {
      throw new Error('Only REVERSED payments can be rolled back');
    }

    // 1. Roll back invoice applications
    for (const refId of payment.appliedInvoiceIds) {
      this.rollbackInvoicePayment(refId, payment);
    }

    // 2. Roll back receivables
    this.rollbackReceivables(payment);
  }

  private rollbackInvoicePayment(
    invoiceId: string,
    payment: Payment
  ): void {
    // Repository contract:
    // - rollbackPayment(invoiceId, amount, paymentId)
    this.invoiceRepository.rollbackPayment(
      invoiceId,
      Math.abs(payment.amount),
      payment.id
    );
  }

  private rollbackReceivables(payment: Payment): void {
    // Repository contract:
    // - rollbackPayment(paymentId, amount)
    this.receivablesRepository.rollbackPayment(
      payment.id,
      Math.abs(payment.amount)
    );
  }
}
