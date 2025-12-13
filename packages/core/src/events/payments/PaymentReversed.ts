// packages/core/src/events/payments/PaymentReversed.ts

import { Payment } from '../../domain/payment/Payment';

/**
 * PaymentReversed
 * ----------------
 * Domain event emitted when a payment is reversed.
 *
 * Consumers (future):
 * - Receivables (reopen balances)
 * - Settlement (undo settlement entries)
 * - Reporting
 */
export class PaymentReversed {
  readonly payment: Payment;
  readonly occurredAt: Date;

  constructor(payment: Payment, occurredAt: Date = new Date()) {
    this.payment = payment;
    this.occurredAt = occurredAt;
  }
}
