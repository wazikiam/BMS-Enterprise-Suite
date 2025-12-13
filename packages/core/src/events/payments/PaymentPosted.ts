// packages/core/src/events/payments/PaymentPosted.ts

import { Payment } from '../../domain/payment/Payment';

/**
 * PaymentPosted
 * -------------
 * Domain event emitted when a payment is posted.
 *
 * Consumers (future):
 * - Receivables
 * - Settlement
 * - Reporting
 */
export class PaymentPosted {
  readonly payment: Payment;
  readonly occurredAt: Date;

  constructor(payment: Payment, occurredAt: Date = new Date()) {
    this.payment = payment;
    this.occurredAt = occurredAt;
  }
}
