// packages/core/src/services/payments/PaymentsService.ts

import { Payment } from '../../domain/payment/Payment';
import { PaymentMethod } from '../../domain/payment/PaymentMethod';
import { PaymentStatus } from '../../domain/payment/PaymentStatus';

/**
 * PaymentsService
 * ----------------
 * Application orchestration for Payments.
 *
 * Responsibilities:
 * - Create payment intents
 * - Post payments against invoices
 * - Reverse posted payments
 *
 * Out of scope (by design):
 * - Persistence
 * - External gateways
 * - Ledger accounting
 */
export class PaymentsService {
  /**
   * Create a pending payment intent (no invoice application yet).
   */
  createPendingPayment(params: {
    id: string;
    amount: number;
    currency: string;
    method: PaymentMethod;
  }): Payment {
    return Payment.createPending(params);
  }

  /**
   * Post a payment and apply it to one or many invoices.
   */
  postPayment(params: {
    id: string;
    amount: number;
    currency: string;
    method: PaymentMethod;
    invoiceIds: string[];
    postedAt?: Date;
  }): Payment {
    if (!params.invoiceIds || params.invoiceIds.length === 0) {
      throw new Error('Cannot post payment without invoiceIds');
    }

    return Payment.createPosted({
      id: params.id,
      amount: params.amount,
      currency: params.currency,
      method: params.method,
      appliedInvoiceIds: params.invoiceIds,
      postedAt: params.postedAt
    });
  }

  /**
   * Reverse an existing posted payment.
   */
  reversePayment(params: {
    id: string;
    originalPaymentId: string;
    amount: number;
    currency: string;
    method: PaymentMethod;
    reversedAt?: Date;
  }): Payment {
    return Payment.createReversal(params);
  }

  /**
   * Helper: determine if a payment affects receivables.
   */
  affectsReceivables(payment: Payment): boolean {
    return payment.status === PaymentStatus.POSTED;
  }
}
