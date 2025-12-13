// packages/core/src/services/PaymentService.ts
import { Payment, PaymentMethod, PaymentStatus } from '../domain/Payment';
import { NotFoundError, ValidationError, BusinessRuleError } from '../errors/ApplicationError';
import { BalanceTransactionType } from '../domain/CustomerBalance';

export interface CreatePaymentDTO {
  saleOrderId: string;
  customerId: string;
  amount: number;
  method: PaymentMethod;
  paymentDate: Date;
  reference?: string;
  notes?: string;
  collectedById: string;
  dueDate?: Date;
  bankName?: string;
  checkNumber?: string;
  transactionId?: string;
}

export interface ProcessPaymentDTO {
  paymentId: string;
  paidAmount: number;
  validatedById?: string;
  receiptNumber?: string;
  transactionId?: string;
}

export interface RefundPaymentDTO {
  paymentId: string;
  refundAmount: number;
  reason?: string;
  processedById: string;
}

export interface PaymentReportDTO {
  startDate: Date;
  endDate: Date;
  method?: PaymentMethod;
  status?: PaymentStatus;
  collectedById?: string;
}

export interface PaymentSummary {
  totalPayments: number;
  totalAmount: number;
  averagePayment: number;
  paymentsByMethod: Record<PaymentMethod, number>;
  paymentsByStatus: Record<PaymentStatus, number>;
  overduePayments: number;
  overdueAmount: number;
}

/**
 * PaymentService — FINAL, LOCKED VERSION
 * -------------------------------------
 * Responsibilities:
 * - Manage payment lifecycle only
 * - Post financial impact to BalanceService (always when money/credit is applied)
 *
 * Explicit boundaries:
 * - Does NOT mutate SaleOrder state (no status changes, no paidAmount updates on orders)
 * - Does NOT enforce credit-limit logic (handled elsewhere)
 */
export class PaymentService {
  constructor(
    private paymentRepository: any,
    private saleOrderRepository: any,
    private customerRepository: any,
    private userRepository: any,
    private balanceService: any
  ) {}

  async createPayment(dto: CreatePaymentDTO): Promise<Payment> {
    const saleOrder = await this.saleOrderRepository.findById(dto.saleOrderId);
    if (!saleOrder) throw new NotFoundError('SaleOrder', dto.saleOrderId);

    const customer = await this.customerRepository.findById(dto.customerId);
    if (!customer) throw new NotFoundError('Customer', dto.customerId);

    const collector = await this.userRepository.findById(dto.collectedById);
    if (!collector) throw new NotFoundError('User', dto.collectedById);

    if (dto.amount <= 0) {
      throw new ValidationError('Payment amount must be greater than zero');
    }

    // Guardrails: do not accept a payment larger than current order due
    if (dto.amount > saleOrder.dueAmount) {
      throw new BusinessRuleError(
        `Payment amount (${dto.amount}) exceeds order due amount (${saleOrder.dueAmount})`
      );
    }

    const payment = new Payment({
      paymentNumber: Payment.generatePaymentNumber(),
      saleOrderId: saleOrder.id!,
      saleOrder,
      customerId: customer.id!,
      customer,
      amount: dto.amount,
      paidAmount: 0,
      dueAmount: dto.amount,
      paymentDate: dto.paymentDate,
      dueDate: dto.dueDate,
      method: dto.method,
      status: PaymentStatus.PENDING,
      reference: dto.reference,
      notes: dto.notes,
      // A payment can be “partial” relative to the order due.
      isPartial: dto.amount < saleOrder.dueAmount,
      collectedById: collector.id!,
      bankName: dto.bankName,
      checkNumber: dto.checkNumber,
      transactionId: dto.transactionId
    });

    this.validatePaymentMethodFields(payment);

    return this.paymentRepository.create(payment);
  }

  async getPaymentById(id: string): Promise<Payment> {
    const payment = await this.paymentRepository.findById(id);
    if (!payment) throw new NotFoundError('Payment', id);
    return payment;
  }

  /**
   * Process a payment ONCE.
   * Idempotency rule:
   * - Only PENDING payments can be processed.
   * - Once processed (PARTIAL/COMPLETED/FAILED/etc), re-processing is blocked.
   */
  async processPayment(dto: ProcessPaymentDTO): Promise<Payment> {
    const payment = await this.getPaymentById(dto.paymentId);

    if (payment.status !== PaymentStatus.PENDING) {
      throw new BusinessRuleError(`Cannot process payment in ${payment.status} status`);
    }

    if (dto.paidAmount <= 0) {
      throw new ValidationError('Paid amount must be greater than zero');
    }

    if (dto.paidAmount > payment.dueAmount) {
      throw new BusinessRuleError(
        `Paid amount (${dto.paidAmount}) exceeds payment due amount (${payment.dueAmount})`
      );
    }

    // Stronger idempotency / anti-duplication:
    // If a transactionId already exists on the payment, it must match.
    if (payment.transactionId && dto.transactionId && payment.transactionId !== dto.transactionId) {
      throw new BusinessRuleError(
        `Transaction ID mismatch. Existing: ${payment.transactionId}, Provided: ${dto.transactionId}`
      );
    }

    // Record payment in domain
    payment.recordPayment(dto.paidAmount, dto.validatedById);

    // Enrich metadata (do not overwrite existing identifiers)
    if (dto.receiptNumber) payment.receiptNumber = dto.receiptNumber;
    if (dto.transactionId && !payment.transactionId) payment.transactionId = dto.transactionId;

    // Persist payment first (so we have a stable ID/receiptNumber for balance reference)
    const updated = await this.paymentRepository.update(payment);

    // Accounting rule:
    // Any processed payment that reduces what the customer owes must be posted to the balance ledger,
    // regardless of the payment method label (cash/card/transfer/credit/etc).
    await this.postPaymentToBalance(updated, dto.paidAmount);

    return updated;
  }

  async refundPayment(dto: RefundPaymentDTO): Promise<Payment> {
    const payment = await this.getPaymentById(dto.paymentId);

    if (payment.status !== PaymentStatus.COMPLETED) {
      throw new BusinessRuleError('Only completed payments can be refunded');
    }

    if (dto.refundAmount <= 0) {
      throw new ValidationError('Refund amount must be greater than zero');
    }

    if (dto.refundAmount > payment.paidAmount) {
      throw new BusinessRuleError('Refund exceeds paid amount');
    }

    // Domain mutation (refund bookkeeping)
    payment.refund(dto.refundAmount, dto.reason);

    const updated = await this.paymentRepository.update(payment);

    // Post refund to ledger as a DEBIT (increases balance owed by customer)
    await this.postRefundToBalance(updated, dto.refundAmount, dto.processedById, dto.reason);

    return updated;
  }

  /* =====================================================
     LEDGER POSTING
     ===================================================== */

  private async postPaymentToBalance(payment: Payment, amount: number): Promise<void> {
    const balance = await this.balanceService.getCustomerBalance(payment.customerId);
    const currency = balance.currency || 'MAD';

    const referenceNumber =
      payment.receiptNumber || payment.paymentNumber || `PAY-${payment.id || Date.now()}`;

    await this.balanceService.createBalanceTransaction({
      customerId: payment.customerId,
      balanceId: balance.id,
      type: BalanceTransactionType.CREDIT, // CREDIT reduces what customer owes
      amount,
      currency,
      referenceType: 'PAYMENT',
      referenceId: payment.id,
      referenceNumber,
      transactionDate: payment.paymentDate,
      postingDate: new Date(),
      status: 'POSTED',
      isReconciled: true,
      description: `Payment received (${payment.method})`,
      notes: payment.reference || payment.notes,
      createdBy: payment.collectedById,

      // Compatibility fields used by your BalanceService/domain
      transactionType: 'PAYMENT',
      balanceBefore: balance.currentBalance,
      balanceAfter: balance.currentBalance - amount,
      createdAt: new Date(),
      version: 1
    });
  }

  private async postRefundToBalance(
    payment: Payment,
    amount: number,
    processedById: string,
    reason?: string
  ): Promise<void> {
    const balance = await this.balanceService.getCustomerBalance(payment.customerId);
    const currency = balance.currency || 'MAD';

    const referenceNumber =
      payment.receiptNumber
        ? `REF-${payment.receiptNumber}`
        : `REF-${payment.paymentNumber || payment.id || Date.now()}`;

    await this.balanceService.createBalanceTransaction({
      customerId: payment.customerId,
      balanceId: balance.id,
      type: BalanceTransactionType.DEBIT, // DEBIT increases what customer owes (refund out)
      amount,
      currency,
      referenceType: 'REFUND',
      referenceId: payment.id,
      referenceNumber,
      transactionDate: new Date(),
      postingDate: new Date(),
      status: 'POSTED',
      isReconciled: true,
      description: `Payment refund (${payment.method})`,
      notes: reason,
      createdBy: processedById,

      // Compatibility fields used by your BalanceService/domain
      transactionType: 'REFUND',
      balanceBefore: balance.currentBalance,
      balanceAfter: balance.currentBalance + amount,
      createdAt: new Date(),
      version: 1
    });
  }

  /* =====================================================
     VALIDATION
     ===================================================== */

  private validatePaymentMethodFields(payment: Payment): void {
    switch (payment.method) {
      case PaymentMethod.CHECK:
        if (!payment.checkNumber || !payment.bankName) {
          throw new ValidationError('Check number and bank name required');
        }
        break;

      case PaymentMethod.BANK_TRANSFER:
      case PaymentMethod.CREDIT_CARD:
      case PaymentMethod.DEBIT_CARD:
      case PaymentMethod.MOBILE_MONEY:
        if (!payment.transactionId) {
          throw new ValidationError('Transaction ID required');
        }
        break;

      default:
        break;
    }
  }
}
