import { Payment, PaymentMethod, PaymentStatus } from '../domain/Payment';
import { NotFoundError, ValidationError, BusinessRuleError } from '../errors/ApplicationError';
import { BalanceTransactionType } from '../domain/CustomerBalance';
import { SaleOrderPaymentProjectionService } from './SaleOrderPaymentProjectionService';

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

/**
 * PaymentService — FINAL & LOCKED
 *
 * RULES:
 * - Owns payment lifecycle ONLY
 * - Posts ledger entries
 * - NEVER mutates SaleOrder directly
 */
export class PaymentService {
  constructor(
    private paymentRepository: any,
    private saleOrderRepository: any,
    private customerRepository: any,
    private userRepository: any,
    private balanceService: any,
    private saleOrderProjectionService: SaleOrderPaymentProjectionService
  ) {}

  async createPayment(dto: CreatePaymentDTO): Promise<Payment> {
    const saleOrder = await this.saleOrderRepository.findById(dto.saleOrderId);
    if (!saleOrder) throw new NotFoundError('SaleOrder', dto.saleOrderId);

    if (dto.amount <= 0) {
      throw new ValidationError('Payment amount must be greater than zero');
    }

    if (dto.amount > saleOrder.dueAmount) {
      throw new BusinessRuleError(
        `Payment exceeds order due amount (${saleOrder.dueAmount})`
      );
    }

    const payment = new Payment({
      paymentNumber: Payment.generatePaymentNumber(),
      saleOrderId: saleOrder.id!,
      saleOrder,
      customerId: dto.customerId,
      amount: dto.amount,
      paidAmount: 0,
      dueAmount: dto.amount,
      paymentDate: dto.paymentDate,
      dueDate: dto.dueDate,
      method: dto.method,
      status: PaymentStatus.PENDING,
      reference: dto.reference,
      notes: dto.notes,
      isPartial: dto.amount < saleOrder.dueAmount,
      collectedById: dto.collectedById,
      bankName: dto.bankName,
      checkNumber: dto.checkNumber,
      transactionId: dto.transactionId
    });

    return this.paymentRepository.create(payment);
  }

  async processPayment(dto: ProcessPaymentDTO): Promise<Payment> {
    const payment = await this.paymentRepository.findById(dto.paymentId);
    if (!payment) throw new NotFoundError('Payment', dto.paymentId);

    if (payment.status !== PaymentStatus.PENDING) {
      throw new BusinessRuleError(`Cannot process ${payment.status} payment`);
    }

    payment.recordPayment(dto.paidAmount, dto.validatedById);

    if (dto.receiptNumber) payment.receiptNumber = dto.receiptNumber;
    if (dto.transactionId) payment.transactionId = dto.transactionId;

    const updated = await this.paymentRepository.update(payment);

    await this.postPaymentToBalance(updated, dto.paidAmount);

    // 🔐 SINGLE PROJECTION POINT
    await this.saleOrderProjectionService.applyPayment(updated);

    return updated;
  }

  async refundPayment(dto: RefundPaymentDTO): Promise<Payment> {
    const payment = await this.paymentRepository.findById(dto.paymentId);
    if (!payment) throw new NotFoundError('Payment', dto.paymentId);

    payment.refund(dto.refundAmount, dto.reason);

    const updated = await this.paymentRepository.update(payment);

    await this.postRefundToBalance(updated, dto.refundAmount, dto.processedById);

    // 🔐 SINGLE PROJECTION POINT
    await this.saleOrderProjectionService.applyRefund(updated, dto.refundAmount);

    return updated;
  }

  private async postPaymentToBalance(payment: Payment, amount: number): Promise<void> {
    const balance = await this.balanceService.getCustomerBalance(payment.customerId);

    await this.balanceService.createBalanceTransaction({
      customerId: payment.customerId,
      balanceId: balance.id,
      type: BalanceTransactionType.CREDIT,
      amount,
      currency: balance.currency || 'MAD',
      referenceType: 'PAYMENT',
      referenceId: payment.id,
      referenceNumber: payment.paymentNumber,
      transactionDate: payment.paymentDate,
      postingDate: new Date(),
      status: 'POSTED',
      isReconciled: true,
      createdBy: payment.collectedById,
      balanceBefore: balance.currentBalance,
      balanceAfter: balance.currentBalance - amount,
      createdAt: new Date(),
      version: 1
    });
  }

  private async postRefundToBalance(
    payment: Payment,
    amount: number,
    processedById: string
  ): Promise<void> {
    const balance = await this.balanceService.getCustomerBalance(payment.customerId);

    await this.balanceService.createBalanceTransaction({
      customerId: payment.customerId,
      balanceId: balance.id,
      type: BalanceTransactionType.DEBIT,
      amount,
      currency: balance.currency || 'MAD',
      referenceType: 'REFUND',
      referenceId: payment.id,
      referenceNumber: `REF-${payment.paymentNumber}`,
      transactionDate: new Date(),
      postingDate: new Date(),
      status: 'POSTED',
      isReconciled: true,
      createdBy: processedById,
      balanceBefore: balance.currentBalance,
      balanceAfter: balance.currentBalance + amount,
      createdAt: new Date(),
      version: 1
    });
  }
}
