import { SaleOrder } from './SaleOrder';
import { Customer } from './Customer';

export enum PaymentStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded'
}

export enum PaymentMethod {
  CASH = 'cash',
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',
  BANK_TRANSFER = 'bank_transfer',
  CHECK = 'check',
  MOBILE_MONEY = 'mobile_money',
  CREDIT = 'credit',
  OTHER = 'other'
}

export interface PaymentProps {
  id?: string;
  paymentNumber: string;
  saleOrderId: string;
  saleOrder?: SaleOrder;
  customerId: string;
  customer?: Customer;
  amount: number;
  paidAmount: number;
  dueAmount: number;
  paymentDate: Date;
  dueDate?: Date;
  method: PaymentMethod;
  status: PaymentStatus;
  reference?: string;
  notes?: string;
  isPartial: boolean;
  collectedById: string;
  validatedById?: string;
  receiptNumber?: string;
  bankName?: string;
  checkNumber?: string;
  transactionId?: string;
  metadata?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Payment {
  public readonly id?: string;
  public readonly paymentNumber: string;
  public readonly saleOrderId: string;
  public saleOrder?: SaleOrder;
  public readonly customerId: string;
  public customer?: Customer;
  public amount: number;
  public paidAmount: number;
  public dueAmount: number;
  public paymentDate: Date;
  public dueDate?: Date;
  public method: PaymentMethod;
  public status: PaymentStatus;
  public reference?: string;
  public notes?: string;
  public isPartial: boolean;
  public readonly collectedById: string;
  public validatedById?: string;
  public receiptNumber?: string;
  public bankName?: string;
  public checkNumber?: string;
  public transactionId?: string;
  public metadata?: Record<string, any>;
  public readonly createdAt?: Date;
  public readonly updatedAt?: Date;

  constructor(props: PaymentProps) {
    this.id = props.id;
    this.paymentNumber = props.paymentNumber;
    this.saleOrderId = props.saleOrderId;
    this.saleOrder = props.saleOrder;
    this.customerId = props.customerId;
    this.customer = props.customer;
    this.amount = props.amount;
    this.paidAmount = props.paidAmount;
    this.dueAmount = props.dueAmount;
    this.paymentDate = props.paymentDate;
    this.dueDate = props.dueDate;
    this.method = props.method;
    this.status = props.status;
    this.reference = props.reference;
    this.notes = props.notes;
    this.isPartial = props.isPartial;
    this.collectedById = props.collectedById;
    this.validatedById = props.validatedById;
    this.receiptNumber = props.receiptNumber;
    this.bankName = props.bankName;
    this.checkNumber = props.checkNumber;
    this.transactionId = props.transactionId;
    this.metadata = props.metadata;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;

    this.validate();
  }

  private validate(): void {
    if (this.amount <= 0) {
      throw new Error('Payment amount must be greater than zero');
    }

    if (this.paidAmount < 0) {
      throw new Error('Paid amount cannot be negative');
    }

    if (this.dueAmount < 0) {
      throw new Error('Due amount cannot be negative');
    }

    if (this.paidAmount > this.amount) {
      throw new Error('Paid amount cannot exceed payment amount');
    }

    if (this.paymentDate > new Date()) {
      throw new Error('Payment date cannot be in the future');
    }

    if (this.dueDate && this.dueDate < this.paymentDate) {
      throw new Error('Due date cannot be before payment date');
    }

    // Validate payment method specific fields
    this.validatePaymentMethodFields();
  }

  private validatePaymentMethodFields(): void {
    switch (this.method) {
      case PaymentMethod.CHECK:
        if (!this.checkNumber) {
          throw new Error('Check number is required for check payments');
        }
        if (!this.bankName) {
          throw new Error('Bank name is required for check payments');
        }
        break;
      
      case PaymentMethod.BANK_TRANSFER:
        if (!this.bankName) {
          throw new Error('Bank name is required for bank transfers');
        }
        if (!this.transactionId) {
          throw new Error('Transaction ID is required for bank transfers');
        }
        break;
      
      case PaymentMethod.CREDIT_CARD:
      case PaymentMethod.DEBIT_CARD:
        if (!this.transactionId) {
          throw new Error('Transaction ID is required for card payments');
        }
        break;
    }
  }

  public recordPayment(paidAmount: number, validatedById?: string): void {
    if (this.status !== PaymentStatus.PENDING) {
      throw new Error(`Cannot record payment for ${this.status} payment`);
    }

    if (paidAmount <= 0) {
      throw new Error('Paid amount must be greater than zero');
    }

    if (paidAmount > this.dueAmount) {
      throw new Error('Paid amount cannot exceed due amount');
    }

    this.paidAmount = paidAmount;
    this.dueAmount = this.amount - this.paidAmount;
    this.isPartial = this.dueAmount > 0;

    if (Math.abs(this.dueAmount) < 0.01) {
      this.status = PaymentStatus.COMPLETED;
    } else {
      this.status = PaymentStatus.PENDING;
    }

    if (validatedById) {
      this.validatedById = validatedById;
    }
  }

  public markAsCompleted(validatedById?: string): void {
    if (this.status !== PaymentStatus.PENDING) {
      throw new Error(`Cannot complete ${this.status} payment`);
    }

    if (Math.abs(this.paidAmount - this.amount) > 0.01) {
      throw new Error('Payment must be fully paid to mark as completed');
    }

    this.status = PaymentStatus.COMPLETED;
    this.dueAmount = 0;
    this.isPartial = false;

    if (validatedById) {
      this.validatedById = validatedById;
    }
  }

  public markAsFailed(reason?: string): void {
    if (this.status === PaymentStatus.COMPLETED || this.status === PaymentStatus.REFUNDED) {
      throw new Error(`Cannot mark ${this.status} payment as failed`);
    }

    this.status = PaymentStatus.FAILED;
    if (reason) {
      this.notes = this.notes ? `${this.notes}\nFailed: ${reason}` : `Failed: ${reason}`;
    }
  }

  public cancel(reason?: string): void {
    if (this.status === PaymentStatus.COMPLETED) {
      throw new Error('Cannot cancel completed payment');
    }

    if (this.status === PaymentStatus.REFUNDED) {
      throw new Error('Cannot cancel refunded payment');
    }

    this.status = PaymentStatus.CANCELLED;
    if (reason) {
      this.notes = this.notes ? `${this.notes}\nCancelled: ${reason}` : `Cancelled: ${reason}`;
    }
  }

  public refund(refundAmount: number, reason?: string): void {
    if (this.status !== PaymentStatus.COMPLETED) {
      throw new Error('Only completed payments can be refunded');
    }

    if (refundAmount <= 0) {
      throw new Error('Refund amount must be greater than zero');
    }

    if (refundAmount > this.paidAmount) {
      throw new Error('Refund amount cannot exceed paid amount');
    }

    this.status = PaymentStatus.REFUNDED;
    this.paidAmount -= refundAmount;
    this.dueAmount = this.amount - this.paidAmount;

    if (reason) {
      this.notes = this.notes ? `${this.notes}\nRefunded: ${reason} (${refundAmount})` : `Refunded: ${reason} (${refundAmount})`;
    }
  }

  public updateReference(newReference: string): void {
    if (!newReference.trim()) {
      throw new Error('Reference cannot be empty');
    }

    this.reference = newReference;
  }

  public updateNotes(newNotes: string): void {
    this.notes = newNotes;
  }

  public isOverdue(): boolean {
    if (!this.dueDate || this.status !== PaymentStatus.PENDING || Math.abs(this.dueAmount) < 0.01) {
      return false;
    }

    return new Date() > this.dueDate;
  }

  public getDaysOverdue(): number {
    if (!this.isOverdue() || !this.dueDate) {
      return 0;
    }

    const today = new Date();
    const dueDate = new Date(this.dueDate);
    const diffTime = Math.abs(today.getTime() - dueDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  public toJSON() {
    return {
      id: this.id,
      paymentNumber: this.paymentNumber,
      saleOrderId: this.saleOrderId,
      saleOrder: this.saleOrder,
      customerId: this.customerId,
      customer: this.customer,
      amount: this.amount,
      paidAmount: this.paidAmount,
      dueAmount: this.dueAmount,
      paymentDate: this.paymentDate,
      dueDate: this.dueDate,
      method: this.method,
      status: this.status,
      reference: this.reference,
      notes: this.notes,
      isPartial: this.isPartial,
      collectedById: this.collectedById,
      validatedById: this.validatedById,
      receiptNumber: this.receiptNumber,
      bankName: this.bankName,
      checkNumber: this.checkNumber,
      transactionId: this.transactionId,
      metadata: this.metadata,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      isOverdue: this.isOverdue(),
      daysOverdue: this.getDaysOverdue()
    };
  }

  // Static method to generate payment number
  public static generatePaymentNumber(prefix: string = 'PAY'): string {
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${prefix}-${timestamp}-${random}`;
  }
} 
