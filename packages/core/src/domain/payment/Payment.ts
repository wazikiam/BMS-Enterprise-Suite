// packages/core/src/domain/payment/Payment.ts

import { PaymentMethod } from './PaymentMethod';
import { PaymentStatus } from './PaymentStatus';

/**
 * Payment
 * -------
 * Immutable payment record.
 *
 * Design principles:
 * - Append-only (never updated, only reversed)
 * - Auditable (timestamps + references preserved)
 * - Can be applied to one or many invoices
 */
export class Payment {
  readonly id: string;
  readonly amount: number;
  readonly currency: string;
  readonly method: PaymentMethod;
  readonly status: PaymentStatus;

  readonly appliedInvoiceIds: string[];

  readonly createdAt: Date;
  readonly postedAt?: Date;
  readonly reversedAt?: Date;

  private constructor(props: {
    id: string;
    amount: number;
    currency: string;
    method: PaymentMethod;
    status: PaymentStatus;
    appliedInvoiceIds?: string[];
    createdAt?: Date;
    postedAt?: Date;
    reversedAt?: Date;
  }) {
    this.id = props.id;
    this.amount = props.amount;
    this.currency = props.currency;
    this.method = props.method;
    this.status = props.status;
    this.appliedInvoiceIds = props.appliedInvoiceIds ?? [];

    this.createdAt = props.createdAt ?? new Date();
    this.postedAt = props.postedAt;
    this.reversedAt = props.reversedAt;

    this.validate();
  }

  /* =====================================================
     FACTORIES
     ===================================================== */

  static createPending(params: {
    id: string;
    amount: number;
    currency: string;
    method: PaymentMethod;
  }): Payment {
    return new Payment({
      ...params,
      status: PaymentStatus.PENDING
    });
  }

  static createPosted(params: {
    id: string;
    amount: number;
    currency: string;
    method: PaymentMethod;
    appliedInvoiceIds: string[];
    postedAt?: Date;
  }): Payment {
    return new Payment({
      ...params,
      status: PaymentStatus.POSTED,
      postedAt: params.postedAt ?? new Date()
    });
  }

  static createReversal(params: {
    id: string;
    originalPaymentId: string;
    amount: number;
    currency: string;
    method: PaymentMethod;
    reversedAt?: Date;
  }): Payment {
    return new Payment({
      id: params.id,
      amount: -Math.abs(params.amount),
      currency: params.currency,
      method: params.method,
      status: PaymentStatus.REVERSED,
      reversedAt: params.reversedAt ?? new Date(),
      appliedInvoiceIds: [params.originalPaymentId]
    });
  }

  /* =====================================================
     INVARIANTS
     ===================================================== */

  private validate(): void {
    if (!this.id) throw new Error('Payment.id is required');
    if (this.amount === 0) throw new Error('Payment.amount cannot be zero');
    if (!this.currency) throw new Error('Payment.currency is required');

    if (this.status === PaymentStatus.POSTED && !this.postedAt) {
      throw new Error('POSTED payment must have postedAt');
    }

    if (this.status === PaymentStatus.REVERSED && !this.reversedAt) {
      throw new Error('REVERSED payment must have reversedAt');
    }
  }
}
