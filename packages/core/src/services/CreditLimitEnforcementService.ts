import { Customer } from '../domain/Customer';
import { SaleOrder } from '../domain/SaleOrder';
import { User, UserRole } from '../domain/User';
import { Transaction, TransactionType } from '../domain/Transaction';
import { NotFoundError, ValidationError, BusinessRuleError } from '../errors/ApplicationError';

/**
 * CREDIT POLICY AUTHORITY (LOCKED FILE)
 * - Single source of truth for credit numbers: creditService.getCustomerCreditInfo()
 * - Do not read currentBalance/creditLimit directly from Customer records.
 * - This service decides: allow/deny/hold + override workflow orchestration.
 *
 * NOTE: Persistence helpers at bottom are TEMPORARY placeholders and must be implemented
 * using a real repository before production.
 */

export type CreditStatus = 'active' | 'hold';

export interface CreditLimitInfo {
  currentBalance: number;
  creditLimit: number;
  overdueAmount?: number;
  maxOverdueDays?: number;
}

export interface CreditLimitCheck {
  customerId: string;
  orderAmount: number;
  currentBalance: number;
  creditLimit: number;
  availableCredit: number;
  willExceedLimit: boolean;
  exceedsLimit: boolean;
  isAllowed: boolean;
  violationType?: 'hard_limit' | 'warning_threshold' | 'overdue_balance';
  message: string;
  requiresOverride: boolean;
  overrideLevel?: 'manager' | 'admin';
  suggestedActions: string[];
}

export interface CreditOverrideRequest {
  customerId: string;
  orderId: string;
  orderAmount: number;
  requestedBy: string;
  overrideReason: string;
  temporaryLimitIncrease?: number;
  temporaryLimitExpiry?: Date;
  notes?: string;
}

export interface CreditOverrideApproval {
  overrideId: string;
  approved: boolean;
  approvedBy: string;
  approvedAt: Date;
  approvalReason?: string;
  conditions?: string[];
}

export interface CreditLimitAlert {
  customerId: string;
  customerName: string;
  alertType: 'limit_exceeded' | 'warning_threshold' | 'overdue_payment' | 'credit_hold';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  data: {
    currentBalance: number;
    creditLimit: number;
    availableCredit: number;
    overdueAmount?: number;
    overdueDays?: number;
  };
  createdAt: Date;
  requiresAction: boolean;
}

export interface CreditLimitConfig {
  warningThreshold: number; // Percentage of limit
  hardLimitThreshold: number; // Percentage of limit (e.g., 100% = no overlimit allowed)
  overdueGracePeriod: number; // Days before considering overdue
  maxOverdueDays: number; // Max days overdue before automatic hold
  autoHoldEnabled: boolean;
  overrideLevels: {
    manager: {
      maxOverrideAmount: number;
      maxOverridePercentage: number;
    };
    admin: {
      maxOverrideAmount: number;
      maxOverridePercentage: number;
    };
  };
}

export class CreditLimitEnforcementService {
  private defaultConfig: CreditLimitConfig = {
    warningThreshold: 80,
    hardLimitThreshold: 100,
    overdueGracePeriod: 7,
    maxOverdueDays: 30,
    autoHoldEnabled: true,
    overrideLevels: {
      manager: { maxOverrideAmount: 5000, maxOverridePercentage: 20 },
      admin: { maxOverrideAmount: 50000, maxOverridePercentage: 100 }
    }
  };

  constructor(
    private customerRepository: any,
    private creditService: any,
    private transactionRepository: any,
    private saleOrderRepository: any,
    private userRepository: any,
    private alertService: any,
    private auditService: any,
    private config: Partial<CreditLimitConfig> = {}
  ) {
    this.config = { ...this.defaultConfig, ...config };
  }

  /* =====================================================
     CORE: CREDIT CHECK
     ===================================================== */
  async checkCreditLimit(customerId: string, orderAmount: number): Promise<CreditLimitCheck> {
    if (!customerId) throw new ValidationError('customerId is required');
    if (!Number.isFinite(orderAmount) || orderAmount <= 0) {
      throw new ValidationError('orderAmount must be a positive number');
    }

    const customer = await this.customerRepository.findById(customerId);
    if (!customer) throw new NotFoundError('Customer', customerId);

    // SINGLE SOURCE OF TRUTH
    const creditInfo: CreditLimitInfo = await this.creditService.getCustomerCreditInfo(customerId);

    const currentBalance = this.toMoney(creditInfo.currentBalance);
    const creditLimit = this.toMoney(creditInfo.creditLimit);

    // If no credit limit configured, treat CREDIT sales as not allowed unless overridden by ADMIN policy elsewhere.
    // For cash/card/check/transfer this check may be irrelevant, but caller decides when to call.
    if (creditLimit <= 0) {
      return {
        customerId,
        orderAmount,
        currentBalance,
        creditLimit,
        availableCredit: 0,
        willExceedLimit: true,
        exceedsLimit: true,
        isAllowed: false,
        violationType: 'hard_limit',
        message: 'No credit limit configured for this customer',
        requiresOverride: true,
        overrideLevel: 'admin',
        suggestedActions: [
          'Set a credit limit for the customer',
          'Request admin override if business-approved',
          'Take payment upfront (non-credit)'
        ]
      };
    }

    const availableCredit = Math.max(0, creditLimit - currentBalance);
    const projectedBalance = currentBalance + orderAmount;

    const exceedsLimit = currentBalance >= creditLimit;
    const willExceedLimit = projectedBalance > creditLimit;

    let isAllowed = true;
    let violationType: CreditLimitCheck['violationType'];
    let message = '';
    let requiresOverride = false;
    let overrideLevel: 'manager' | 'admin' | undefined;
    const suggestedActions: string[] = [];

    // Hard limit: already exceeded
    if (exceedsLimit) {
      isAllowed = false;
      violationType = 'hard_limit';
      message = `Credit limit already exceeded. Current balance: ${currentBalance}, Limit: ${creditLimit}`;
      requiresOverride = true;
      overrideLevel = this.determineOverrideLevel(Math.max(0, currentBalance - creditLimit), 0);
      suggestedActions.push('Make a payment to reduce balance');
      suggestedActions.push('Request credit limit increase');
      suggestedActions.push('Request manager/admin override (policy-based)');
    } else {
      // Check warning threshold
      const warningThreshold = this.config.warningThreshold ?? 80;
      const usageAfter = (projectedBalance / creditLimit) * 100;

      if (usageAfter >= warningThreshold && usageAfter < (this.config.hardLimitThreshold ?? 100)) {
        violationType = 'warning_threshold';
        message = `Order will bring credit usage to ${usageAfter.toFixed(1)}% of limit`;
        suggestedActions.push('Consider partial payment');
        suggestedActions.push('Review order amount');
      }

      // Hard limit: will exceed
      if (willExceedLimit) {
        const exceedAmount = projectedBalance - creditLimit;
        const exceedPercentage = (exceedAmount / creditLimit) * 100;

        isAllowed = false;
        violationType = 'hard_limit';
        message = `Order will exceed credit limit by ${exceedAmount} (${exceedPercentage.toFixed(1)}%)`;
        requiresOverride = true;
        overrideLevel = this.determineOverrideLevel(exceedAmount, exceedPercentage);
        suggestedActions.push('Request credit limit override');
        suggestedActions.push('Split order into multiple payments');
      }
    }

    // Overdue checks (using transaction repository for now; consider migrating to BalanceService later)
    const overdueInfo = await this.checkOverduePayments(customerId);
    if (overdueInfo.hasOverdue) {
      if (!violationType) violationType = 'overdue_balance';

      const overdueMsg = `Overdue payments: ${overdueInfo.overdueAmount} overdue for ${overdueInfo.maxOverdueDays} days`;
      message = message ? `${message}. Also: ${overdueMsg}` : overdueMsg;

      if (overdueInfo.maxOverdueDays > (this.config.maxOverdueDays ?? 30)) {
        isAllowed = false;
        requiresOverride = true;
        overrideLevel = overrideLevel ?? 'manager';
        suggestedActions.push('Collect overdue payments');
        suggestedActions.push('Place customer on credit hold if necessary');
      } else {
        suggestedActions.push('Review overdue payments');
      }
    }

    if (!message) {
      message = isAllowed
        ? `Credit available: ${availableCredit}. Order amount: ${orderAmount}`
        : 'Credit limit check failed';
    }

    return {
      customerId,
      orderAmount,
      currentBalance,
      creditLimit,
      availableCredit,
      willExceedLimit,
      exceedsLimit,
      isAllowed,
      violationType,
      message,
      requiresOverride,
      overrideLevel,
      suggestedActions
    };
  }

  /* =====================================================
     OVERRIDE WORKFLOW
     ===================================================== */
  async requestCreditOverride(request: CreditOverrideRequest): Promise<{
    overrideId: string;
    requiresApproval: boolean;
    approvalLevel?: 'manager' | 'admin';
    approvalRequiredBy?: string[];
    message: string;
  }> {
    const customer = await this.customerRepository.findById(request.customerId);
    if (!customer) throw new NotFoundError('Customer', request.customerId);

    const requester = await this.userRepository.findById(request.requestedBy);
    if (!requester) throw new NotFoundError('User', request.requestedBy);

    const creditCheck = await this.checkCreditLimit(request.customerId, request.orderAmount);

    if (!creditCheck.requiresOverride) {
      throw new BusinessRuleError('No credit override required for this order');
    }

    const approvalLevel = creditCheck.overrideLevel || 'manager';
    const canSelfApprove = this.canSelfApproveOverride(requester, approvalLevel);

    if (canSelfApprove) {
      const overrideId = `OVERRIDE-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      await this.approveCreditOverride({
        overrideId,
        approved: true,
        approvedBy: request.requestedBy,
        approvedAt: new Date(),
        approvalReason: 'Self-approved by authorized user',
        conditions: ['Order must be delivered within 30 days', 'Regular payment terms apply']
      });

      return { overrideId, requiresApproval: false, message: 'Override auto-approved' };
    }

    const approvers = await this.getApproversForLevel(approvalLevel, request.requestedBy);
    if (approvers.length === 0) {
      throw new BusinessRuleError(`No approvers available for ${approvalLevel} level override`);
    }

    const overrideId = `OVERRIDE-REQ-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    await this.saveOverrideRequest({
      id: overrideId,
      customerId: request.customerId,
      orderId: request.orderId,
      orderAmount: request.orderAmount,
      requesterId: request.requestedBy,
      requesterName: `${requester.firstName} ${requester.lastName}`,
      overrideReason: request.overrideReason,
      approvalLevel,
      approvers,
      status: 'pending',
      createdAt: new Date(),
      temporaryLimitIncrease: request.temporaryLimitIncrease,
      temporaryLimitExpiry: request.temporaryLimitExpiry,
      notes: request.notes
    });

    await this.notifyApprovers(approvers, {
      overrideId,
      customerName: customer.name,
      orderId: request.orderId,
      orderAmount: request.orderAmount,
      requesterName: `${requester.firstName} ${requester.lastName}`,
      reason: request.overrideReason
    });

    await this.auditService.logCreditEvent({
      customerId: request.customerId,
      event: 'credit_override_requested',
      amount: request.orderAmount,
      requestedBy: request.requestedBy,
      metadata: { overrideId, approvalLevel, approvers: approvers.map(a => a.userId) }
    });

    return {
      overrideId,
      requiresApproval: true,
      approvalLevel,
      approvalRequiredBy: approvers.map(a => a.userId),
      message: `Override request submitted. Awaiting approval from ${approvers.length} approver(s).`
    };
  }

  async approveCreditOverride(approval: CreditOverrideApproval): Promise<{
    success: boolean;
    overrideDetails: any;
    temporaryLimitApplied: boolean;
  }> {
    const overrideRequest = await this.getOverrideRequest(approval.overrideId);
    if (!overrideRequest) throw new NotFoundError('CreditOverride', approval.overrideId);

    if (overrideRequest.status !== 'pending') {
      throw new BusinessRuleError(`Cannot approve override in ${overrideRequest.status} status`);
    }

    const approver = await this.userRepository.findById(approval.approvedBy);
    if (!approver) throw new NotFoundError('User', approval.approvedBy);

    const isAuthorized = await this.isApproverAuthorized(
      approver,
      overrideRequest.approvalLevel,
      overrideRequest.approvers
    );

    if (!isAuthorized) throw new BusinessRuleError('User not authorized to approve this override');

    overrideRequest.status = approval.approved ? 'approved' : 'rejected';
    overrideRequest.approvedBy = approval.approvedBy;
    overrideRequest.approvedAt = approval.approvedAt;
    overrideRequest.approvalReason = approval.approvalReason;
    overrideRequest.conditions = approval.conditions;

    await this.updateOverrideRequest(overrideRequest);

    let temporaryLimitApplied = false;
    if (approval.approved && overrideRequest.temporaryLimitIncrease) {
      await this.applyTemporaryCreditLimit(
        overrideRequest.customerId,
        overrideRequest.temporaryLimitIncrease,
        overrideRequest.temporaryLimitExpiry
      );
      temporaryLimitApplied = true;
    }

    await this.notifyRequester(overrideRequest.requesterId, {
      overrideId: approval.overrideId,
      approved: approval.approved,
      approvedBy: approval.approvedBy,
      approvalReason: approval.approvalReason,
      customerId: overrideRequest.customerId,
      orderId: overrideRequest.orderId
    });

    await this.auditService.logCreditEvent({
      customerId: overrideRequest.customerId,
      event: approval.approved ? 'credit_override_approved' : 'credit_override_rejected',
      amount: overrideRequest.orderAmount,
      processedBy: approval.approvedBy,
      metadata: {
        overrideId: approval.overrideId,
        approvalReason: approval.approvalReason,
        temporaryLimitApplied
      }
    });

    return { success: true, overrideDetails: overrideRequest, temporaryLimitApplied };
  }

  /* =====================================================
     CREDIT HOLD
     ===================================================== */
  async placeOnCreditHold(customerId: string, reason: string, placedBy: string): Promise<{
    success: boolean;
    holdId: string;
    restrictions: string[];
  }> {
    const customer = await this.customerRepository.findById(customerId);
    if (!customer) throw new NotFoundError('Customer', customerId);

    const placer = await this.userRepository.findById(placedBy);
    if (!placer) throw new NotFoundError('User', placedBy);

    const currentStatus: CreditStatus = (customer.creditStatus as CreditStatus) || 'active';
    if (currentStatus === 'hold') throw new BusinessRuleError('Customer already on credit hold');

    const holdId = `HOLD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    customer.creditStatus = 'hold';
    customer.creditHoldReason = reason;
    customer.creditHoldDate = new Date();
    customer.creditHoldBy = placedBy;
    customer.creditHoldId = holdId;

    await this.customerRepository.update(customer);

    const pendingOrders = await this.saleOrderRepository.findPendingByCustomer(customerId);
    for (const order of pendingOrders) {
      if (order.status === 'draft' || order.status === 'confirmed') {
        await this.saleOrderRepository.cancelOrder(order.id!, `Auto-cancelled due to credit hold: ${reason}`);
      }
    }

    // Use creditService as source of truth for numbers
    const creditInfo: CreditLimitInfo = await this.creditService.getCustomerCreditInfo(customerId);
    const currentBalance = this.toMoney(creditInfo.currentBalance);
    const creditLimit = this.toMoney(creditInfo.creditLimit);

    await this.createCreditLimitAlert({
      customerId,
      customerName: customer.name,
      alertType: 'credit_hold',
      severity: 'critical',
      message: `Customer placed on credit hold: ${reason}`,
      data: {
        currentBalance,
        creditLimit,
        availableCredit: Math.max(0, creditLimit - currentBalance)
      },
      createdAt: new Date(),
      requiresAction: true
    });

    await this.auditService.logCreditEvent({
      customerId,
      event: 'credit_hold_placed',
      amount: currentBalance,
      processedBy: placedBy,
      metadata: { holdId, reason, pendingOrdersCancelled: pendingOrders.length }
    });

    return {
      success: true,
      holdId,
      restrictions: [
        'No new credit sales allowed',
        'Existing orders may be cancelled',
        'Payments still accepted',
        'Credit limit overrides not permitted'
      ]
    };
  }

  async removeFromCreditHold(customerId: string, reason: string, removedBy: string): Promise<{
    success: boolean;
    holdRemoved: boolean;
    message: string;
  }> {
    const customer = await this.customerRepository.findById(customerId);
    if (!customer) throw new NotFoundError('Customer', customerId);

    const remover = await this.userRepository.findById(removedBy);
    if (!remover) throw new NotFoundError('User', removedBy);

    const currentStatus: CreditStatus = (customer.creditStatus as CreditStatus) || 'active';
    if (currentStatus !== 'hold') {
      return { success: false, holdRemoved: false, message: 'Customer is not on credit hold' };
    }

    customer.creditStatus = 'active';
    customer.creditHoldReason = undefined;
    customer.creditHoldDate = undefined;
    customer.creditHoldBy = undefined;
    customer.creditHoldId = undefined;

    await this.customerRepository.update(customer);

    const creditInfo: CreditLimitInfo = await this.creditService.getCustomerCreditInfo(customerId);
    const currentBalance = this.toMoney(creditInfo.currentBalance);
    const creditLimit = this.toMoney(creditInfo.creditLimit);

    await this.createCreditLimitAlert({
      customerId,
      customerName: customer.name,
      alertType: 'credit_hold',
      severity: 'info',
      message: `Credit hold removed: ${reason}`,
      data: {
        currentBalance,
        creditLimit,
        availableCredit: Math.max(0, creditLimit - currentBalance)
      },
      createdAt: new Date(),
      requiresAction: false
    });

    await this.auditService.logCreditEvent({
      customerId,
      event: 'credit_hold_removed',
      amount: currentBalance,
      processedBy: removedBy,
      metadata: { reason }
    });

    return { success: true, holdRemoved: true, message: 'Credit hold removed successfully' };
  }

  /* =====================================================
     OVERDUE CHECKS
     ===================================================== */
  async checkOverduePayments(customerId: string): Promise<{
    hasOverdue: boolean;
    overdueAmount: number;
    maxOverdueDays: number;
    overduePayments: Array<{ paymentId: string; amount: number; dueDate: Date; daysOverdue: number }>;
  }> {
    // NOTE: This is an integration seam. If you already have BalanceService aging logic,
    // you can replace this with a call to BalanceService to avoid duplicate overdue definitions.
    const overduePayments = await this.transactionRepository.findOverdueByCustomer(customerId);

    if (!Array.isArray(overduePayments) || overduePayments.length === 0) {
      return { hasOverdue: false, overdueAmount: 0, maxOverdueDays: 0, overduePayments: [] };
    }

    const overdueAmount = overduePayments.reduce((sum: number, p: any) => sum + this.toMoney(p.amount), 0);
    const maxOverdueDays = Math.max(...overduePayments.map((p: any) => Number(p.daysOverdue || 0)));

    return {
      hasOverdue: true,
      overdueAmount,
      maxOverdueDays,
      overduePayments: overduePayments.map((p: any) => ({
        paymentId: p.id,
        amount: this.toMoney(p.amount),
        dueDate: p.dueDate,
        daysOverdue: Number(p.daysOverdue || 0)
      }))
    };
  }

  /* =====================================================
     ALERT GENERATION (BATCH)
     ===================================================== */
  async generateCreditAlerts(): Promise<{ alertsGenerated: number; alerts: CreditLimitAlert[] }> {
    const alerts: CreditLimitAlert[] = [];

    const customers = await this.customerRepository.findAllActive();

    for (const customer of customers) {
      // SINGLE SOURCE OF TRUTH for numbers
      const creditInfo: CreditLimitInfo = await this.creditService.getCustomerCreditInfo(customer.id!);
      const currentBalance = this.toMoney(creditInfo.currentBalance);
      const creditLimit = this.toMoney(creditInfo.creditLimit);

      if (creditLimit <= 0) continue;

      const usagePercentage = (currentBalance / creditLimit) * 100;
      const warningThreshold = this.config.warningThreshold ?? 80;

      if (usagePercentage >= warningThreshold && usagePercentage < 100) {
        alerts.push({
          customerId: customer.id!,
          customerName: customer.name,
          alertType: 'warning_threshold',
          severity: 'warning',
          message: `Credit usage at ${usagePercentage.toFixed(1)}% of limit`,
          data: {
            currentBalance,
            creditLimit,
            availableCredit: Math.max(0, creditLimit - currentBalance)
          },
          createdAt: new Date(),
          requiresAction: true
        });
      }

      if (currentBalance > creditLimit) {
        const exceedAmount = currentBalance - creditLimit;
        const exceedPercentage = (exceedAmount / creditLimit) * 100;

        alerts.push({
          customerId: customer.id!,
          customerName: customer.name,
          alertType: 'limit_exceeded',
          severity: 'critical',
          message: `Credit limit exceeded by ${exceedAmount} (${exceedPercentage.toFixed(1)}%)`,
          data: { currentBalance, creditLimit, availableCredit: 0 },
          createdAt: new Date(),
          requiresAction: true
        });
      }

      const overdueInfo = await this.checkOverduePayments(customer.id!);
      if (overdueInfo.hasOverdue) {
        alerts.push({
          customerId: customer.id!,
          customerName: customer.name,
          alertType: 'overdue_payment',
          severity: overdueInfo.maxOverdueDays > 30 ? 'critical' : 'warning',
          message: `Overdue payments: ${overdueInfo.overdueAmount} overdue for ${overdueInfo.maxOverdueDays} days`,
          data: {
            currentBalance,
            creditLimit,
            availableCredit: Math.max(0, creditLimit - currentBalance),
            overdueAmount: overdueInfo.overdueAmount,
            overdueDays: overdueInfo.maxOverdueDays
          },
          createdAt: new Date(),
          requiresAction: true
        });

        if (this.config.autoHoldEnabled && overdueInfo.maxOverdueDays >= (this.config.maxOverdueDays ?? 30)) {
          try {
            await this.placeOnCreditHold(
              customer.id!,
              `Auto-hold: Payments overdue for ${overdueInfo.maxOverdueDays} days`,
              'system'
            );
          } catch (error) {
            console.error(`Failed to auto-hold customer ${customer.id}:`, error);
          }
        }
      }
    }

    for (const alert of alerts) {
      await this.createCreditLimitAlert(alert);
    }

    return { alertsGenerated: alerts.length, alerts };
  }

  updateConfig(newConfig: Partial<CreditLimitConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): CreditLimitConfig {
    return { ...(this.config as CreditLimitConfig) };
  }

  /* =====================================================
     PRIVATE HELPERS
     ===================================================== */
  private determineOverrideLevel(exceedAmount: number, exceedPercentage: number): 'manager' | 'admin' {
    const managerLimit = this.config.overrideLevels?.manager.maxOverrideAmount ?? 5000;
    const managerPercentage = this.config.overrideLevels?.manager.maxOverridePercentage ?? 20;

    if (exceedAmount <= managerLimit && exceedPercentage <= managerPercentage) return 'manager';
    return 'admin';
  }

  private canSelfApproveOverride(user: User, level: 'manager' | 'admin'): boolean {
    if (user.role === UserRole.ADMIN) return true;
    if (user.role === UserRole.MANAGER && level === 'manager') return true;
    return false;
  }

  private async getApproversForLevel(
    level: 'manager' | 'admin',
    excludeUserId: string
  ): Promise<Array<{ userId: string; name: string; role: string }>> {
    const role = level === 'manager' ? UserRole.MANAGER : UserRole.ADMIN;
    const users = await this.userRepository.findByRole(role);

    return users
      .filter((u: User) => u.id !== excludeUserId && (u as any).isActive)
      .map((u: User) => ({ userId: u.id!, name: `${u.firstName} ${u.lastName}`, role: u.role }));
  }

  private async isApproverAuthorized(
    approver: User,
    requiredLevel: 'manager' | 'admin',
    approverList: Array<{ userId: string }>
  ): Promise<boolean> {
    const isInList = approverList.some(a => a.userId === approver.id);
    const hasRequiredRole =
      requiredLevel === 'manager'
        ? approver.role === UserRole.MANAGER || approver.role === UserRole.ADMIN
        : approver.role === UserRole.ADMIN;

    return isInList && hasRequiredRole;
  }

  private async applyTemporaryCreditLimit(customerId: string, increaseAmount: number, expiryDate?: Date): Promise<void> {
    await this.creditService.setTemporaryLimit(
      customerId,
      increaseAmount,
      expiryDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    );
  }

  private async createCreditLimitAlert(alert: CreditLimitAlert): Promise<void> {
    if (this.alertService) {
      await this.alertService.createCreditAlert(alert);
    }
  }

  private toMoney(n: any): number {
    const v = Number(n);
    if (!Number.isFinite(v)) return 0;
    return Math.round(v * 100) / 100;
  }

  /* =====================================================
     TEMPORARY PERSISTENCE SEAMS (MUST IMPLEMENT)
     ===================================================== */
  private async saveOverrideRequest(request: any): Promise<void> {
    // TODO(PROD): replace with repository insert
    console.log('[TEMP] Saving override request:', request);
  }

  private async getOverrideRequest(overrideId: string): Promise<any> {
    // TODO(PROD): replace with repository query
    // Keeping a minimal shape so flows compile.
    return {
      id: overrideId,
      status: 'pending',
      approvalLevel: 'manager',
      approvers: [{ userId: 'manager1' }]
    };
  }

  private async updateOverrideRequest(request: any): Promise<void> {
    // TODO(PROD): replace with repository update
    console.log('[TEMP] Updating override request:', request);
  }

  private async notifyApprovers(approvers: Array<{ userId: string; name: string }>, details: any): Promise<void> {
    // TODO(PROD): implement notification
    console.log('[TEMP] Notifying approvers:', approvers, details);
  }

  private async notifyRequester(requesterId: string, details: any): Promise<void> {
    // TODO(PROD): implement notification
    console.log('[TEMP] Notifying requester:', requesterId, details);
  }
}
