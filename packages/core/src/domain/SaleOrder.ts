import { Customer } from './Customer';
import { Payment } from './Payment';
import { SaleOrderLine } from './SaleOrderLine';
import { User } from './User';

export enum SaleOrderStatus {
  DRAFT = 'draft',
  CONFIRMED = 'confirmed',
  VALIDATED = 'validated',
  PARTIALLY_PAID = 'partially_paid',
  FULLY_PAID = 'fully_paid',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  CREDIT_HOLD = 'credit_hold'
}

export enum PaymentType {
  CASH = 'cash',
  CARD = 'card',
  CHECK = 'check',
  TRANSFER = 'transfer',
  CREDIT = 'credit'
}

export enum DocumentType {
  INVOICE = 'invoice',
  DELIVERY_NOTE = 'delivery_note',
  RECEIPT = 'receipt',
  QUOTATION = 'quotation'
}

export interface SaleOrderProps {
  id?: string;
  orderNumber: string;
  customerId: string;
  customer?: Customer;
  orderDate: Date;
  deliveryDate?: Date;
  status: SaleOrderStatus;
  paymentType: PaymentType;
  paymentStatus: 'pending' | 'partial' | 'paid' | 'overdue';
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  notes?: string;
  createdById: string;
  createdBy?: User;
  validatedById?: string;
  validatedBy?: User;
  paymentTerms?: string;
  shippingAddress?: string;
  billingAddress?: string;
  documentType: DocumentType;
  lines: SaleOrderLine[];
  payments: Payment[];
  createdAt?: Date;
  updatedAt?: Date;
}

export class SaleOrder {
  public readonly id?: string;
  public readonly orderNumber: string;
  public readonly customerId: string;
  public customer?: Customer;
  public orderDate: Date;
  public deliveryDate?: Date;
  public status: SaleOrderStatus;
  public paymentType: PaymentType;
  public paymentStatus: 'pending' | 'partial' | 'paid' | 'overdue';
  public subtotal: number;
  public taxAmount: number;
  public discountAmount: number;
  public totalAmount: number;
  public paidAmount: number;
  public dueAmount: number;
  public notes?: string;
  public readonly createdById: string;
  public createdBy?: User;
  public validatedById?: string;
  public validatedBy?: User;
  public paymentTerms?: string;
  public shippingAddress?: string;
  public billingAddress?: string;
  public documentType: DocumentType;
  public lines: SaleOrderLine[];
  public payments: Payment[];
  public readonly createdAt?: Date;
  public readonly updatedAt?: Date;

  constructor(props: SaleOrderProps) {
    this.id = props.id;
    this.orderNumber = props.orderNumber;
    this.customerId = props.customerId;
    this.customer = props.customer;
    this.orderDate = props.orderDate;
    this.deliveryDate = props.deliveryDate;
    this.status = props.status;
    this.paymentType = props.paymentType;
    this.paymentStatus = props.paymentStatus;
    this.subtotal = props.subtotal;
    this.taxAmount = props.taxAmount;
    this.discountAmount = props.discountAmount;
    this.totalAmount = props.totalAmount;
    this.paidAmount = props.paidAmount;
    this.dueAmount = props.dueAmount;
    this.notes = props.notes;
    this.createdById = props.createdById;
    this.createdBy = props.createdBy;
    this.validatedById = props.validatedById;
    this.validatedBy = props.validatedBy;
    this.paymentTerms = props.paymentTerms;
    this.shippingAddress = props.shippingAddress;
    this.billingAddress = props.billingAddress;
    this.documentType = props.documentType;
    this.lines = props.lines;
    this.payments = props.payments;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;

    this.validate();
  }

  /* =====================================================
     DOMAIN VALIDATION
     ===================================================== */
  private validate(): void {
    if (this.subtotal < 0) throw new Error('Subtotal cannot be negative');
    if (this.taxAmount < 0) throw new Error('Tax amount cannot be negative');
    if (this.discountAmount < 0) throw new Error('Discount amount cannot be negative');
    if (this.totalAmount < 0) throw new Error('Total amount cannot be negative');
    if (this.paidAmount < 0) throw new Error('Paid amount cannot be negative');
    if (this.dueAmount < 0) throw new Error('Due amount cannot be negative');

    const calculatedTotal = this.subtotal + this.taxAmount - this.discountAmount;
    if (Math.abs(calculatedTotal - this.totalAmount) > 0.01) {
      throw new Error(`Total amount mismatch. Calculated=${calculatedTotal}, Stored=${this.totalAmount}`);
    }

    const calculatedDue = this.totalAmount - this.paidAmount;
    if (Math.abs(calculatedDue - this.dueAmount) > 0.01) {
      throw new Error(`Due amount mismatch. Calculated=${calculatedDue}, Stored=${this.dueAmount}`);
    }
  }

  /* =====================================================
     STATUS TRANSITIONS
     ===================================================== */
  public updateStatus(newStatus: SaleOrderStatus, validatedById?: string): void {
    const allowed: Record<SaleOrderStatus, SaleOrderStatus[]> = {
      [SaleOrderStatus.DRAFT]: [SaleOrderStatus.CONFIRMED, SaleOrderStatus.CANCELLED],
      [SaleOrderStatus.CONFIRMED]: [
        SaleOrderStatus.VALIDATED,
        SaleOrderStatus.CREDIT_HOLD,
        SaleOrderStatus.CANCELLED
      ],
      [SaleOrderStatus.VALIDATED]: [
        SaleOrderStatus.PARTIALLY_PAID,
        SaleOrderStatus.FULLY_PAID,
        SaleOrderStatus.CANCELLED
      ],
      [SaleOrderStatus.PARTIALLY_PAID]: [
        SaleOrderStatus.FULLY_PAID,
        SaleOrderStatus.CANCELLED
      ],
      [SaleOrderStatus.FULLY_PAID]: [SaleOrderStatus.COMPLETED],
      [SaleOrderStatus.COMPLETED]: [],
      [SaleOrderStatus.CANCELLED]: [],
      [SaleOrderStatus.CREDIT_HOLD]: [
        SaleOrderStatus.VALIDATED,
        SaleOrderStatus.CANCELLED
      ]
    };

    if (!allowed[this.status].includes(newStatus)) {
      throw new Error(`Invalid status transition from ${this.status} to ${newStatus}`);
    }

    if (newStatus === SaleOrderStatus.VALIDATED && validatedById) {
      this.validatedById = validatedById;
    }

    this.status = newStatus;
  }

  /**
   * Explicit domain method used by SaleOrderService
   */
  public placeOnCreditHold(): void {
    if (
      this.status !== SaleOrderStatus.CONFIRMED &&
      this.status !== SaleOrderStatus.VALIDATED
    ) {
      throw new Error(`Cannot place order on credit hold from ${this.status}`);
    }

    this.status = SaleOrderStatus.CREDIT_HOLD;
  }

  /* =====================================================
     PAYMENTS (AGGREGATE-LEVEL ONLY)
     ===================================================== */
  public addPayment(amount: number): void {
    if ([SaleOrderStatus.CANCELLED, SaleOrderStatus.COMPLETED].includes(this.status)) {
      throw new Error(`Cannot add payment to order in ${this.status}`);
    }

    if (amount <= 0) throw new Error('Payment amount must be positive');

    if (this.paidAmount + amount > this.totalAmount) {
      throw new Error('Payment exceeds order total');
    }

    this.paidAmount += amount;
    this.dueAmount = this.totalAmount - this.paidAmount;

    if (this.paidAmount === 0) {
      this.paymentStatus = 'pending';
    } else if (this.dueAmount > 0) {
      this.paymentStatus = 'partial';
      this.updateStatus(SaleOrderStatus.PARTIALLY_PAID);
    } else {
      this.paymentStatus = 'paid';
      this.updateStatus(SaleOrderStatus.FULLY_PAID);
    }
  }

  /* =====================================================
     HELPERS
     ===================================================== */
  public calculateTotals(): void {
    this.subtotal = this.lines.reduce((s, l) => s + l.subtotal, 0);
    this.totalAmount = this.subtotal + this.taxAmount - this.discountAmount;
    this.dueAmount = this.totalAmount - this.paidAmount;
  }

  public hasStockIssues(): boolean {
    return this.lines.some(l => l.quantity > (l.product?.availableStock ?? 0));
  }

  public toJSON() {
    return {
      id: this.id,
      orderNumber: this.orderNumber,
      customerId: this.customerId,
      customer: this.customer,
      orderDate: this.orderDate,
      deliveryDate: this.deliveryDate,
      status: this.status,
      paymentType: this.paymentType,
      paymentStatus: this.paymentStatus,
      subtotal: this.subtotal,
      taxAmount: this.taxAmount,
      discountAmount: this.discountAmount,
      totalAmount: this.totalAmount,
      paidAmount: this.paidAmount,
      dueAmount: this.dueAmount,
      notes: this.notes,
      createdById: this.createdById,
      validatedById: this.validatedById,
      paymentTerms: this.paymentTerms,
      shippingAddress: this.shippingAddress,
      billingAddress: this.billingAddress,
      documentType: this.documentType,
      lines: this.lines.map(l => l.toJSON()),
      payments: this.payments.map(p => p.toJSON()),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}
