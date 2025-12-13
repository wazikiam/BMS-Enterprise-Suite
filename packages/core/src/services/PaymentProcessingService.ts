import { Payment, PaymentMethod, PaymentStatus } from '../domain/Payment';
import { PaymentMethod as PaymentMethodDomain } from '../domain/PaymentMethod';
import { SaleOrder } from '../domain/SaleOrder';
import { Customer } from '../domain/Customer';
import { User } from '../domain/User';
import { PaymentTerm } from '../domain/PaymentTerm';
import { NotFoundError, ValidationError, BusinessRuleError } from '../errors/ApplicationError';

export interface ProcessPaymentRequest {
  paymentId: string;
  amount: number;
  methodDetails?: {
    cardNumber?: string;
    cardHolder?: string;
    expiryDate?: string;
    cvv?: string;
    bankAccount?: string;
    checkNumber?: string;
    mobileNumber?: string;
    transactionId?: string;
  };
  processedById: string;
  notes?: string;
  reference?: string;
  skipValidation?: boolean;
}

export interface PaymentAuthorizationResult {
  authorized: boolean;
  authorizationCode?: string;
  transactionId?: string;
  gatewayResponse?: any;
  error?: string;
  requires3DS?: boolean;
  redirectUrl?: string;
}

export interface PaymentSettlementResult {
  settled: boolean;
  settlementId?: string;
  transactionId?: string; // Added missing property
  settledAmount: number;
  settlementDate: Date;
  fees: number;
  netAmount: number;
  gatewayResponse?: any;
  error?: string;
}

export interface RefundRequest {
  paymentId: string;
  amount: number;
  reason: string;
  processedById: string;
  reference?: string;
}

export interface PaymentReconciliationResult {
  reconciled: boolean;
  matchedAmount: number;
  differences: Array<{
    field: string;
    expected: any;
    actual: any;
  }>;
  notes?: string;
}

export interface BatchPaymentProcessingResult {
  totalProcessed: number;
  successful: Array<{
    paymentId: string;
    amount: number;
    transactionId?: string;
  }>;
  failed: Array<{
    paymentId: string;
    amount: number;
    error: string;
  }>;
  totalAmount: number;
}

export class PaymentProcessingService {
  private paymentGateways: Map<string, any> = new Map();

  constructor(
    private paymentRepository: any,
    private saleOrderRepository: any,
    private customerRepository: any,
    private userRepository: any,
    private paymentMethodRepository: any,
    private creditService: any,
    private auditService: any
  ) {}

  /**
   * Register a payment gateway
   */
  registerGateway(gatewayName: string, gateway: any): void {
    this.paymentGateways.set(gatewayName.toLowerCase(), gateway);
  }

  /**
   * Process a payment
   */
  async processPayment(request: ProcessPaymentRequest): Promise<{
    payment: Payment;
    authorization: PaymentAuthorizationResult;
    settlement?: PaymentSettlementResult;
  }> {
    // Get payment
    const payment = await this.paymentRepository.findById(request.paymentId);
    if (!payment) {
      throw new NotFoundError('Payment', request.paymentId);
    }

    // Get processor user
    const processor = await this.userRepository.findById(request.processedById);
    if (!processor) {
      throw new NotFoundError('User', request.processedById);
    }

    // Validate payment amount
    if (request.amount <= 0) {
      throw new ValidationError('Payment amount must be greater than zero');
    }

    if (request.amount > payment.dueAmount) {
      throw new BusinessRuleError(
        `Payment amount (${request.amount}) exceeds due amount (${payment.dueAmount})`
      );
    }

    // Get payment method details
    const paymentMethod = await this.paymentMethodRepository.findByCode(payment.method);
    if (!paymentMethod) {
      throw new NotFoundError('PaymentMethod', payment.method);
    }

    // Validate payment method is active
    if (!paymentMethod.isActive || paymentMethod.status !== 'active') {
      throw new BusinessRuleError(`Payment method ${paymentMethod.name} is not active`);
    }

    // Check payment limits
    const limitCheck = paymentMethod.checkLimits(request.amount);
    if (!limitCheck.isValid) {
      throw new BusinessRuleError(`Payment limit violation: ${limitCheck.violations.join(', ')}`);
    }

    // Authorize payment
    const authorization = await this.authorizePayment(
      payment,
      paymentMethod,
      request.amount,
      request.methodDetails,
      request.skipValidation
    );

    if (!authorization.authorized) {
      throw new BusinessRuleError(`Payment authorization failed: ${authorization.error}`);
    }

    // Update payment with authorization details
    payment.transactionId = authorization.transactionId;
    payment.reference = request.reference || authorization.authorizationCode;
    
    if (request.notes) {
      payment.notes = payment.notes ? `${payment.notes}\n${request.notes}` : request.notes;
    }

    // Record payment
    payment.recordPayment(request.amount, request.processedById);

    // If authorization includes 3DS redirect, return early
    if (authorization.requires3DS && authorization.redirectUrl) {
      await this.paymentRepository.update(payment);
      
      await this.auditService.logPaymentEvent({
        paymentId: payment.id!,
        event: 'payment_authorization_3ds_required',
        amount: request.amount,
        status: payment.status,
        processorId: request.processedById,
        metadata: {
          authorizationCode: authorization.authorizationCode,
          redirectUrl: authorization.redirectUrl
        }
      });

      return {
        payment,
        authorization,
        settlement: undefined
      };
    }

    // Process settlement for non-3DS payments
    let settlement: PaymentSettlementResult | undefined;
    
    if (paymentMethod.requiresOnlineProcessing && !authorization.requires3DS) {
      settlement = await this.settlePayment(payment, paymentMethod, request.amount);
      
      if (!settlement.settled) {
        // Mark payment as failed if settlement fails
        payment.markAsFailed(`Settlement failed: ${settlement.error}`);
        await this.paymentRepository.update(payment);
        
        throw new BusinessRuleError(`Payment settlement failed: ${settlement.error}`);
      }
    }

    // Update sale order payment status
    const saleOrder = await this.saleOrderRepository.findById(payment.saleOrderId);
    if (saleOrder) {
      saleOrder.addPayment(request.amount, payment.method);
      await this.saleOrderRepository.update(saleOrder);
    }

    // Update customer balance for non-credit payments
    if (payment.method !== PaymentMethod.CREDIT) {
      await this.creditService.recordPayment(
        payment.customerId,
        request.amount,
        'payment_processed',
        payment.id,
        request.processedById
      );
    }

    // Save updated payment
    const updatedPayment = await this.paymentRepository.update(payment);

    // Audit log
    await this.auditService.logPaymentEvent({
      paymentId: payment.id!,
      event: 'payment_processed',
      amount: request.amount,
      status: payment.status,
      processorId: request.processedById,
      metadata: {
        authorizationCode: authorization.authorizationCode,
        transactionId: authorization.transactionId,
        settledAmount: settlement?.settledAmount,
        fees: settlement?.fees
      }
    });

    return {
      payment: updatedPayment,
      authorization,
      settlement
    };
  }

  /**
   * Complete 3DS payment after redirect
   */
  async complete3DSPayment(
    paymentId: string,
    paRes: string, // 3DS authentication response
    processedById: string
  ): Promise<{
    payment: Payment;
    settlement: PaymentSettlementResult;
  }> {
    const payment = await this.paymentRepository.findById(paymentId);
    if (!payment) {
      throw new NotFoundError('Payment', paymentId);
    }

    if (payment.status !== PaymentStatus.PENDING) {
      throw new BusinessRuleError(`Cannot complete 3DS payment in ${payment.status} status`);
    }

    const paymentMethod = await this.paymentMethodRepository.findByCode(payment.method);
    if (!paymentMethod) {
      throw new NotFoundError('PaymentMethod', payment.method);
    }

    // Verify 3DS response with gateway
    const gateway = this.getPaymentGateway(paymentMethod.processingProvider);
    if (!gateway || !gateway.verify3DS) {
      throw new BusinessRuleError('3DS verification not supported for this payment method');
    }

    const verificationResult = await gateway.verify3DS({
      transactionId: payment.transactionId,
      paRes,
      amount: payment.amount
    });

    if (!verificationResult.verified) {
      payment.markAsFailed(`3DS verification failed: ${verificationResult.error}`);
      await this.paymentRepository.update(payment);
      
      throw new BusinessRuleError(`3DS verification failed: ${verificationResult.error}`);
    }

    // Process settlement
    const settlement = await this.settlePayment(payment, paymentMethod, payment.amount);
    
    if (!settlement.settled) {
      payment.markAsFailed(`Settlement failed after 3DS: ${settlement.error}`);
      await this.paymentRepository.update(payment);
      
      throw new BusinessRuleError(`Payment settlement failed: ${settlement.error}`);
    }

    // Update payment status
    payment.markAsCompleted(processedById);
    payment.transactionId = settlement.transactionId || payment.transactionId;
    
    const updatedPayment = await this.paymentRepository.update(payment);

    // Update sale order
    const saleOrder = await this.saleOrderRepository.findById(payment.saleOrderId);
    if (saleOrder) {
      saleOrder.addPayment(payment.amount, payment.method);
      await this.saleOrderRepository.update(saleOrder);
    }

    // Update customer balance
    if (payment.method !== PaymentMethod.CREDIT) {
      await this.creditService.recordPayment(
        payment.customerId,
        payment.amount,
        'payment_processed_3ds',
        payment.id,
        processedById
      );
    }

    await this.auditService.logPaymentEvent({
      paymentId: payment.id!,
      event: 'payment_3ds_completed',
      amount: payment.amount,
      status: payment.status,
      processorId: processedById,
      metadata: {
        transactionId: settlement.transactionId,
        settledAmount: settlement.settledAmount,
        fees: settlement.fees
      }
    });

    return {
      payment: updatedPayment,
      settlement
    };
  }

  /**
   * Process refund
   */
  async processRefund(request: RefundRequest): Promise<{
    payment: Payment;
    refundTransactionId?: string;
    refundAmount: number;
  }> {
    const payment = await this.paymentRepository.findById(request.paymentId);
    if (!payment) {
      throw new NotFoundError('Payment', request.paymentId);
    }

    if (payment.status !== PaymentStatus.COMPLETED) {
      throw new BusinessRuleError(`Cannot refund payment in ${payment.status} status`);
    }

    if (request.amount <= 0) {
      throw new ValidationError('Refund amount must be greater than zero');
    }

    if (request.amount > payment.paidAmount) {
      throw new BusinessRuleError(
        `Refund amount (${request.amount}) exceeds paid amount (${payment.paidAmount})`
      );
    }

    const processor = await this.userRepository.findById(request.processedById);
    if (!processor) {
      throw new NotFoundError('User', request.processedById);
    }

    // Process refund through gateway if needed
    let refundTransactionId: string | undefined;
    const paymentMethod = await this.paymentMethodRepository.findByCode(payment.method);
    
    if (paymentMethod && paymentMethod.requiresOnlineProcessing) {
      const gateway = this.getPaymentGateway(paymentMethod.processingProvider);
      if (gateway && gateway.refund) {
        const refundResult = await gateway.refund({
          originalTransactionId: payment.transactionId,
          amount: request.amount,
          currency: 'MAD',
          reason: request.reason
        });

        if (!refundResult.success) {
          throw new BusinessRuleError(`Refund failed: ${refundResult.error}`);
        }

        refundTransactionId = refundResult.transactionId;
      }
    }

    // Update payment
    payment.refund(request.amount, request.reason);
    
    if (refundTransactionId) {
      payment.metadata = {
        ...payment.metadata,
        refundTransactionId,
        refundProcessedById: request.processedById,
        refundProcessedAt: new Date().toISOString()
      };
    }

    const updatedPayment = await this.paymentRepository.update(payment);

    // Update customer balance
    await this.creditService.recordRefund(
      payment.customerId,
      request.amount,
      'payment_refund',
      payment.id,
      request.processedById
    );

    // Update sale order if needed
    const saleOrder = await this.saleOrderRepository.findById(payment.saleOrderId);
    if (saleOrder && saleOrder.paidAmount > 0) {
      // This would need to adjust sale order paid amount
      // Implementation depends on business rules
    }

    await this.auditService.logPaymentEvent({
      paymentId: payment.id!,
      event: 'payment_refunded',
      amount: request.amount,
      status: payment.status,
      processorId: request.processedById,
      metadata: {
        reason: request.reason,
        refundTransactionId,
        originalTransactionId: payment.transactionId
      }
    });

    return {
      payment: updatedPayment,
      refundTransactionId,
      refundAmount: request.amount
    };
  }

  /**
   * Process batch payments
   */
  async processBatchPayments(
    paymentIds: string[],
    processedById: string
  ): Promise<BatchPaymentProcessingResult> {
    const result: BatchPaymentProcessingResult = {
      totalProcessed: 0,
      successful: [],
      failed: [],
      totalAmount: 0
    };

    const processor = await this.userRepository.findById(processedById);
    if (!processor) {
      throw new NotFoundError('User', processedById);
    }

    for (const paymentId of paymentIds) {
      try {
        const payment = await this.paymentRepository.findById(paymentId);
        if (!payment) {
          throw new NotFoundError('Payment', paymentId);
        }

        // Process full payment amount
        const processResult = await this.processPayment({
          paymentId,
          amount: payment.amount,
          processedById,
          notes: 'Batch processed'
        });

        result.successful.push({
          paymentId,
          amount: payment.amount,
          transactionId: processResult.authorization.transactionId
        });
        
        result.totalAmount += payment.amount;
      } catch (error: any) {
        result.failed.push({
          paymentId,
          amount: 0,
          error: error.message
        });
      }
    }

    result.totalProcessed = result.successful.length;

    await this.auditService.logPaymentEvent({
      event: 'batch_payments_processed',
      processorId: processedById,
      metadata: {
        totalProcessed: result.totalProcessed,
        totalAmount: result.totalAmount,
        successfulCount: result.successful.length,
        failedCount: result.failed.length
      }
    });

    return result;
  }

  /**
   * Reconcile payment with bank statement
   */
  async reconcilePayment(
    paymentId: string,
    bankStatementEntry: {
      amount: number;
      date: Date;
      reference: string;
      description?: string;
    }
  ): Promise<PaymentReconciliationResult> {
    const payment = await this.paymentRepository.findById(paymentId);
    if (!payment) {
      throw new NotFoundError('Payment', paymentId);
    }

    const differences: PaymentReconciliationResult['differences'] = [];
    let matchedAmount = 0;

    // Check amount
    if (Math.abs(payment.amount - bankStatementEntry.amount) > 0.01) {
      differences.push({
        field: 'amount',
        expected: payment.amount,
        actual: bankStatementEntry.amount
      });
    } else {
      matchedAmount = bankStatementEntry.amount;
    }

    // Check date (allow some tolerance)
    const paymentDate = new Date(payment.paymentDate);
    const statementDate = new Date(bankStatementEntry.date);
    const dateDiff = Math.abs(paymentDate.getTime() - statementDate.getTime());
    const dayDiff = dateDiff / (1000 * 60 * 60 * 24);

    if (dayDiff > 5) { // More than 5 days difference
      differences.push({
        field: 'date',
        expected: paymentDate,
        actual: statementDate
      });
    }

    // Check reference if available
    if (payment.reference && bankStatementEntry.reference) {
      if (!bankStatementEntry.reference.includes(payment.reference) &&
          !payment.reference.includes(bankStatementEntry.reference)) {
        differences.push({
          field: 'reference',
          expected: payment.reference,
          actual: bankStatementEntry.reference
        });
      }
    }

    // Update payment if reconciled
    if (differences.length === 0) {
      payment.metadata = {
        ...payment.metadata,
        reconciled: true,
        reconciledAt: new Date().toISOString(),
        bankStatementMatch: {
          amount: bankStatementEntry.amount,
          date: bankStatementEntry.date,
          reference: bankStatementEntry.reference
        }
      };

      await this.paymentRepository.update(payment);

      await this.auditService.logPaymentEvent({
        paymentId: payment.id!,
        event: 'payment_reconciled',
        amount: payment.amount,
        status: payment.status,
        metadata: {
          bankStatementReference: bankStatementEntry.reference
        }
      });
    }

    return {
      reconciled: differences.length === 0,
      matchedAmount,
      differences,
      notes: differences.length > 0 ? 'Reconciliation failed' : 'Successfully reconciled'
    };
  }

  /**
   * Calculate payment fees
   */
  async calculatePaymentFees(
    amount: number,
    paymentMethodCode: string,
    currency: string = 'MAD'
  ): Promise<{
    grossAmount: number;
    feeAmount: number;
    netAmount: number;
    feeBreakdown: Array<{
      type: string;
      amount: number;
      rate?: number;
    }>;
  }> {
    const paymentMethod = await this.paymentMethodRepository.findByCode(paymentMethodCode);
    if (!paymentMethod) {
      throw new NotFoundError('PaymentMethod', paymentMethodCode);
    }

    // Check if method supports currency
    if (!paymentMethod.isAvailableForCurrency(currency)) {
      throw new BusinessRuleError(`Payment method not available for currency: ${currency}`);
    }

    // Calculate base fee
    const baseFee = paymentMethod.calculateFee(amount);
    const netAmount = paymentMethod.calculateNetAmount(amount);

    const feeBreakdown = [{
      type: 'processing_fee',
      amount: baseFee,
      rate: paymentMethod.fees.type === 'percentage' ? paymentMethod.fees.value : undefined
    }];

    // Add VAT if applicable (example)
    const vatRate = 0.20; // 20% VAT
    const vatAmount = baseFee * vatRate;
    
    if (vatAmount > 0) {
      feeBreakdown.push({
        type: 'vat',
        amount: vatAmount,
        rate: vatRate * 100
      });
    }

    const totalFees = feeBreakdown.reduce((sum, fee) => sum + fee.amount, 0);

    return {
      grossAmount: amount,
      feeAmount: parseFloat(totalFees.toFixed(2)),
      netAmount: parseFloat((amount - totalFees).toFixed(2)),
      feeBreakdown
    };
  }

  /**
   * Get payment status summary
   */
  async getPaymentStatusSummary(dateRange: { start: Date; end: Date }): Promise<{
    totalPayments: number;
    totalAmount: number;
    byStatus: Record<PaymentStatus, { count: number; amount: number }>;
    byMethod: Record<string, { count: number; amount: number }>;
    averagePayment: number;
    successRate: number;
  }> {
    const payments = await this.paymentRepository.findByDateRange(dateRange.start, dateRange.end);

    const summary = {
      totalPayments: payments.length,
      totalAmount: 0,
      byStatus: {} as Record<PaymentStatus, { count: number; amount: number }>,
      byMethod: {} as Record<string, { count: number; amount: number }>,
      averagePayment: 0,
      successRate: 0
    };

    // Initialize status counts
    Object.values(PaymentStatus).forEach((status: PaymentStatus) => {
      summary.byStatus[status] = { count: 0, amount: 0 };
    });

    let successfulPayments = 0;

    payments.forEach((payment: Payment) => {
      summary.totalAmount += payment.amount;
      
      // Status summary
      summary.byStatus[payment.status].count++;
      summary.byStatus[payment.status].amount += payment.amount;
      
      // Method summary
      if (!summary.byMethod[payment.method]) {
        summary.byMethod[payment.method] = { count: 0, amount: 0 };
      }
      summary.byMethod[payment.method].count++;
      summary.byMethod[payment.method].amount += payment.amount;
      
      // Count successful payments
      if (payment.status === PaymentStatus.COMPLETED) {
        successfulPayments++;
      }
    });

    summary.averagePayment = summary.totalPayments > 0 
      ? summary.totalAmount / summary.totalPayments 
      : 0;
    
    summary.successRate = summary.totalPayments > 0
      ? (successfulPayments / summary.totalPayments) * 100
      : 0;

    return summary;
  }

  /**
   * Private helper: Authorize payment
   */
  private async authorizePayment(
    payment: Payment,
    paymentMethod: PaymentMethodDomain,
    amount: number,
    methodDetails?: any,
    skipValidation?: boolean
  ): Promise<PaymentAuthorizationResult> {
    // For credit payments, validate credit limit
    if (payment.method === PaymentMethod.CREDIT) {
      const creditValidation = await this.creditService.validateCreditLimit(
        payment.customerId,
        amount
      );

      if (!creditValidation.isValid) {
        return {
          authorized: false,
          error: `Credit limit exceeded. Available: ${creditValidation.availableCredit}, Requested: ${amount}`
        };
      }

      return {
        authorized: true,
        authorizationCode: `CREDIT-${Date.now()}`,
        transactionId: `CREDIT-TX-${Date.now()}`
      };
    }

    // For cash payments
    if (payment.method === PaymentMethod.CASH) {
      return {
        authorized: true,
        authorizationCode: `CASH-${Date.now()}`,
        transactionId: `CASH-TX-${Date.now()}`
      };
    }

    // For check payments
    if (payment.method === PaymentMethod.CHECK) {
      if (!methodDetails?.checkNumber) {
        return {
          authorized: false,
          error: 'Check number is required'
        };
      }

      // Basic check validation (would be more comprehensive in production)
      const isValidCheck = this.validateCheckDetails(methodDetails);
      if (!isValidCheck && !skipValidation) {
        return {
          authorized: false,
          error: 'Invalid check details'
        };
      }

      return {
        authorized: true,
        authorizationCode: `CHECK-${methodDetails.checkNumber}`,
        transactionId: `CHECK-TX-${Date.now()}`
      };
    }

    // For online payment methods, use gateway
    if (paymentMethod.requiresOnlineProcessing && paymentMethod.processingProvider) {
      const gateway = this.getPaymentGateway(paymentMethod.processingProvider);
      if (!gateway) {
        return {
          authorized: false,
          error: `Payment gateway not found: ${paymentMethod.processingProvider}`
        };
      }

      try {
        const authorizationResult = await gateway.authorize({
          amount,
          currency: 'MAD',
          paymentMethod: payment.method,
          methodDetails,
          customerId: payment.customerId,
          orderId: payment.saleOrderId,
          metadata: {
            paymentId: payment.id,
            paymentNumber: payment.paymentNumber
          }
        });

        return {
          authorized: authorizationResult.authorized,
          authorizationCode: authorizationResult.authorizationCode,
          transactionId: authorizationResult.transactionId,
          gatewayResponse: authorizationResult.gatewayResponse,
          error: authorizationResult.error,
          requires3DS: authorizationResult.requires3DS,
          redirectUrl: authorizationResult.redirectUrl
        };
      } catch (error: any) {
        return {
          authorized: false,
          error: `Gateway authorization failed: ${error.message}`
        };
      }
    }

    // Default authorization for other methods
    return {
      authorized: true,
      authorizationCode: `AUTH-${Date.now()}`,
      transactionId: `TX-${Date.now()}`
    };
  }

  /**
   * Private helper: Settle payment
   */
  private async settlePayment(
    payment: Payment,
    paymentMethod: PaymentMethodDomain,
    amount: number
  ): Promise<PaymentSettlementResult> {
    // For non-online payments, settlement is immediate
    if (!paymentMethod.requiresOnlineProcessing) {
      return {
        settled: true,
        settledAmount: amount,
        settlementDate: new Date(),
        fees: 0,
        netAmount: amount
      };
    }

    // For online payments, use gateway
    const gateway = this.getPaymentGateway(paymentMethod.processingProvider);
    if (!gateway || !gateway.settle) {
      return {
        settled: false,
        settledAmount: 0,
        settlementDate: new Date(),
        fees: 0,
        netAmount: 0,
        error: 'Settlement not supported for this payment method'
      };
    }

    try {
      const settlementResult = await gateway.settle({
        transactionId: payment.transactionId,
        amount,
        currency: 'MAD',
        metadata: {
          paymentId: payment.id,
          paymentNumber: payment.paymentNumber
        }
      });

      if (!settlementResult.settled) {
        return {
          settled: false,
          settledAmount: 0,
          settlementDate: new Date(),
          fees: 0,
          netAmount: 0,
          error: settlementResult.error,
          gatewayResponse: settlementResult.gatewayResponse
        };
      }

      return {
        settled: true,
        settlementId: settlementResult.settlementId,
        transactionId: settlementResult.transactionId,
        settledAmount: settlementResult.settledAmount,
        settlementDate: settlementResult.settlementDate,
        fees: settlementResult.fees || 0,
        netAmount: settlementResult.netAmount || amount,
        gatewayResponse: settlementResult.gatewayResponse
      };
    } catch (error: any) {
      return {
        settled: false,
        settledAmount: 0,
        settlementDate: new Date(),
        fees: 0,
        netAmount: 0,
        error: `Settlement failed: ${error.message}`
      };
    }
  }

  /**
   * Private helper: Get payment gateway
   */
  private getPaymentGateway(gatewayName?: string): any {
    if (!gatewayName) return null;
    return this.paymentGateways.get(gatewayName.toLowerCase()) || null;
  }

  /**
   * Private helper: Validate check details
   */
  private validateCheckDetails(details: any): boolean {
    if (!details.checkNumber || !details.bankName) {
      return false;
    }

    // Basic check number validation (would be more comprehensive)
    const checkNumber = details.checkNumber.toString().trim();
    if (checkNumber.length < 3 || checkNumber.length > 20) {
      return false;
    }

    // Check for obvious fake check numbers
    const fakePatterns = ['123456', '000000', '111111'];
    if (fakePatterns.includes(checkNumber)) {
      return false;
    }

    return true;
  }

  /**
   * Generate payment receipt
   */
  async generatePaymentReceipt(paymentId: string): Promise<{
    receiptNumber: string;
    receiptDate: Date;
    payment: Payment;
    saleOrder?: SaleOrder;
    customer?: Customer;
    processor?: User;
    breakdown: {
      subtotal: number;
      tax: number;
      fees: number;
      total: number;
      paid: number;
      due: number;
    };
  }> {
    const payment = await this.paymentRepository.findById(paymentId);
    if (!payment) {
      throw new NotFoundError('Payment', paymentId);
    }

    const saleOrder = await this.saleOrderRepository.findById(payment.saleOrderId);
    const customer = await this.customerRepository.findById(payment.customerId);
    const processor = await this.userRepository.findById(payment.collectedById);

    // Generate receipt number
    const receiptNumber = `RCPT-${payment.paymentNumber}`;

    // Calculate breakdown
    const breakdown = {
      subtotal: saleOrder?.subtotal || 0,
      tax: saleOrder?.taxAmount || 0,
      fees: 0, // Would calculate actual fees
      total: payment.amount,
      paid: payment.paidAmount,
      due: payment.dueAmount
    };

    return {
      receiptNumber,
      receiptDate: new Date(),
      payment,
      saleOrder,
      customer,
      processor,
      breakdown
    };
  }

  /**
   * Void a payment (cancel before settlement)
   */
  async voidPayment(paymentId: string, reason: string, processedById: string): Promise<Payment> {
    const payment = await this.paymentRepository.findById(paymentId);
    if (!payment) {
      throw new NotFoundError('Payment', paymentId);
    }

    if (payment.status !== PaymentStatus.PENDING) {
      throw new BusinessRuleError(`Cannot void payment in ${payment.status} status`);
    }

    const paymentMethod = await this.paymentMethodRepository.findByCode(payment.method);
    
    // Void through gateway if needed
    if (paymentMethod?.requiresOnlineProcessing && payment.transactionId) {
      const gateway = this.getPaymentGateway(paymentMethod.processingProvider);
      if (gateway && gateway.void) {
        const voidResult = await gateway.void({
          transactionId: payment.transactionId,
          reason
        });

        if (!voidResult.success) {
          throw new BusinessRuleError(`Void failed: ${voidResult.error}`);
        }
      }
    }

    payment.cancel(reason);
    const updatedPayment = await this.paymentRepository.update(payment);

    await this.auditService.logPaymentEvent({
      paymentId: payment.id!,
      event: 'payment_voided',
      amount: payment.amount,
      status: payment.status,
      processorId: processedById,
      metadata: { reason }
    });

    return updatedPayment;
  }
}