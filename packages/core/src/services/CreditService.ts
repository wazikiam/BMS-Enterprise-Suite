// packages/core/src/services/CreditService.ts
import {
  CreditLimit,
  CreditLimitStatus,
  CreditLimitChangeRequest,
  CreditLimitApplication,
  CreditLimitValidation,
  CreditLimitHistory,
  CreditLimitUtilization,
  CreditLimitSettings
} from '../domain/CreditLimit';
import { CustomerBalance, BalanceAgeAnalysis } from '../domain/CustomerBalance';
import { Transaction, TransactionType } from '../domain/Transaction';
import { Customer } from '../domain/Customer';
import { ValidationError, NotFoundError, BusinessRuleError } from '../errors/ApplicationError';

// Repository interfaces (these would typically be imported from actual files)
interface ICreditLimitRepository {
  findById(id: string): Promise<CreditLimit | null>;
  findActiveByCustomerId(customerId: string): Promise<CreditLimit | null>;
  create(data: Omit<CreditLimit, 'id'>): Promise<CreditLimit>;
  update(id: string, data: Partial<CreditLimit>): Promise<CreditLimit>;
  getHistoryByCustomerId(customerId: string): Promise<CreditLimitHistory[]>;
  createHistory(data: Omit<CreditLimitHistory, 'id'>): Promise<void>;
}

interface ICustomerBalanceRepository {
  findByCustomerId(customerId: string): Promise<CustomerBalance | null>;
  update(id: string, data: Partial<CustomerBalance>): Promise<void>;
}

interface ITransactionRepository {
  findByCustomerId(customerId: string, page: number, limit: number): Promise<{ transactions: Transaction[], total: number }>;
  findByCustomerIdAndDate(customerId: string, startDate: Date, endDate: Date): Promise<Transaction[]>;
}

interface ICustomerRepository {
  findById(id: string): Promise<Customer | null>;
  findAllActive(): Promise<Customer[]>;
}

export interface ICreditService {
  // Credit limit management
  applyForCreditLimit(application: CreditLimitApplication): Promise<CreditLimit>;
  approveCreditLimit(limitId: string, approvedBy: string, notes?: string): Promise<CreditLimit>;
  rejectCreditLimit(limitId: string, rejectedBy: string, reason: string): Promise<void>;
  suspendCreditLimit(limitId: string, suspendedBy: string, reason: string): Promise<void>;
  reinstateCreditLimit(limitId: string, reinstatedBy: string, reason: string): Promise<void>;
  updateCreditLimit(limitId: string, newAmount: number, changedBy: string, reason: string): Promise<CreditLimit>;
  
  // Credit validation
  validateCreditForTransaction(customerId: string, transactionAmount: number): Promise<CreditLimitValidation>;
  checkCreditLimit(customerId: string, amount: number): Promise<{ allowed: boolean; availableCredit: number; reason?: string }>;
  calculateCreditScore(customerId: string): Promise<number>; // 0-100
  
  // Credit limit requests
  submitCreditLimitChangeRequest(request: Omit<CreditLimitChangeRequest, 'id'>): Promise<CreditLimitChangeRequest>;
  approveCreditLimitChange(requestId: string, approvedBy: string, notes?: string): Promise<CreditLimit>;
  rejectCreditLimitChange(requestId: string, rejectedBy: string, reason: string): Promise<void>;
  
  // Credit utilization and reporting
  getCreditUtilization(customerId: string): Promise<CreditLimitUtilization>;
  getHighUtilizationCustomers(threshold: number): Promise<CreditLimitUtilization[]>;
  getCreditLimitHistory(customerId: string): Promise<CreditLimitHistory[]>;
  
  // Settings management
  getCreditSettings(): Promise<CreditLimitSettings>;
  updateCreditSettings(settings: Partial<CreditLimitSettings>, updatedBy: string): Promise<CreditLimitSettings>;
  
  // Override management (for managers)
  createCreditOverride(customerId: string, amount: number, overrideBy: string, reason: string, expiryDate?: Date): Promise<CreditLimit>;
  validateOverride(customerId: string, overrideId: string): Promise<boolean>;
  
  // Risk assessment
  assessCreditRisk(customerId: string): Promise<{
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    riskScore: number;
    factors: string[];
    recommendations: string[];
  }>;
  
  // Periodic review
  performCreditReview(customerId: string, reviewedBy: string): Promise<{
    currentLimit: number;
    recommendedLimit: number;
    reviewNotes: string;
    nextReviewDate: Date;
  }>;
}

export class CreditService implements ICreditService {
  constructor(
    private creditLimitRepository: ICreditLimitRepository,
    private balanceRepository: ICustomerBalanceRepository,
    private transactionRepository: ITransactionRepository,
    private customerRepository: ICustomerRepository
  ) {}

  async applyForCreditLimit(application: CreditLimitApplication): Promise<CreditLimit> {
    const customer = await this.customerRepository.findById(application.customerId);
    if (!customer) {
      throw new NotFoundError('Customer', application.customerId); // FIXED: Added resourceType
    }

    // Check for existing active limit
    const existingLimit = await this.creditLimitRepository.findActiveByCustomerId(application.customerId);
    if (existingLimit) {
      throw new BusinessRuleError('Customer already has an active credit limit');
    }

    // Validate application amount
    const settings = await this.getCreditSettings();
    if (application.requestedAmount > settings.maximumCreditLimit) {
      throw new BusinessRuleError(`Requested amount exceeds maximum limit of ${settings.maximumCreditLimit}`);
    }

    if (application.requestedAmount < settings.minimumCreditLimit) {
      throw new BusinessRuleError(`Requested amount is below minimum limit of ${settings.minimumCreditLimit}`);
    }

    // Determine approval level
    let approvalLevel: 'AUTO' | 'MANAGER' | 'ADMIN' = 'AUTO';
    let requiresApproval = false;
    let status = CreditLimitStatus.PENDING;

    if (application.requestedAmount <= settings.autoApproveThreshold) {
      approvalLevel = 'AUTO';
      requiresApproval = false;
      status = CreditLimitStatus.APPROVED;
    } else if (application.requestedAmount <= settings.managerApprovalThreshold) {
      approvalLevel = 'MANAGER';
      requiresApproval = true;
      status = CreditLimitStatus.PENDING;
    } else {
      approvalLevel = 'ADMIN';
      requiresApproval = true;
      status = CreditLimitStatus.PENDING;
    }

    const creditLimit: Omit<CreditLimit, 'id'> = {
      customerId: application.customerId,
      amount: application.requestedAmount,
      currency: application.currency || 'MAD',
      validFrom: new Date(),
      paymentTerms: 30,
      interestRate: 0, // Default no interest
      gracePeriod: 7,
      status,
      isActive: status === CreditLimitStatus.APPROVED,
      requiresApproval,
      approvalLevel,
      currentUtilization: 0,
      availableCredit: application.requestedAmount,
      createdBy: application.appliedBy,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const createdLimit = await this.creditLimitRepository.create(creditLimit);

    // Create history entry
    await this.creditLimitRepository.createHistory({
      creditLimitId: createdLimit.id,
      customerId: application.customerId,
      previousAmount: 0,
      newAmount: application.requestedAmount,
      changeType: 'INITIAL',
      changedBy: application.appliedBy,
      changedAt: new Date(),
      changeReason: 'Initial credit limit application'
    });

    // Update customer balance record
    const balance = await this.balanceRepository.findByCustomerId(application.customerId);
    if (balance) {
      await this.balanceRepository.update(balance.id, {
        creditLimit: application.requestedAmount,
        availableBalance: application.requestedAmount - balance.currentBalance,
        lastUpdated: new Date(),
        updatedBy: application.appliedBy,
        version: balance.version + 1
      });
    }

    return createdLimit;
  }

  async approveCreditLimit(limitId: string, approvedBy: string, notes?: string): Promise<CreditLimit> {
    const limit = await this.creditLimitRepository.findById(limitId);
    if (!limit) {
      throw new NotFoundError('CreditLimit', limitId); // FIXED: Added resourceType
    }

    if (limit.status !== CreditLimitStatus.PENDING) {
      throw new BusinessRuleError(`Credit limit is not in PENDING status (current: ${limit.status})`);
    }

    // Check approval authority
    if (limit.approvalLevel === 'MANAGER' && !this.isManager(approvedBy)) {
      throw new BusinessRuleError('Only managers can approve this credit limit');
    }

    if (limit.approvalLevel === 'ADMIN' && !this.isAdmin(approvedBy)) {
      throw new BusinessRuleError('Only admins can approve this credit limit');
    }

    const updatedLimit = await this.creditLimitRepository.update(limitId, {
      status: CreditLimitStatus.APPROVED,
      isActive: true,
      approvedBy,
      approvedAt: new Date(),
      updatedAt: new Date(),
      updatedBy: approvedBy
    });

    // Create history entry
    await this.creditLimitRepository.createHistory({
      creditLimitId: limitId,
      customerId: limit.customerId,
      previousAmount: limit.amount,
      newAmount: limit.amount,
      changeType: 'APPROVAL',
      changedBy: approvedBy,
      changedAt: new Date(),
      changeReason: `Credit limit approved${notes ? `: ${notes}` : ''}`
    });

    return updatedLimit;
  }

  async rejectCreditLimit(limitId: string, rejectedBy: string, reason: string): Promise<void> {
    const limit = await this.creditLimitRepository.findById(limitId);
    if (!limit) {
      throw new NotFoundError('CreditLimit', limitId); // FIXED: Added resourceType
    }

    if (limit.status !== CreditLimitStatus.PENDING) {
      throw new BusinessRuleError(`Credit limit is not in PENDING status (current: ${limit.status})`);
    }

    await this.creditLimitRepository.update(limitId, {
      status: CreditLimitStatus.REJECTED,
      isActive: false,
      updatedAt: new Date(),
      updatedBy: rejectedBy
    });

    // Create history entry
    await this.creditLimitRepository.createHistory({
      creditLimitId: limitId,
      customerId: limit.customerId,
      previousAmount: limit.amount,
      newAmount: 0,
      changeType: 'REJECTION',
      changedBy: rejectedBy,
      changedAt: new Date(),
      changeReason: `Credit limit rejected: ${reason}`
    });
  }

  async suspendCreditLimit(limitId: string, suspendedBy: string, reason: string): Promise<void> {
    const limit = await this.creditLimitRepository.findById(limitId);
    if (!limit) {
      throw new NotFoundError('CreditLimit', limitId); // FIXED: Added resourceType
    }

    if (!limit.isActive) {
      throw new BusinessRuleError('Credit limit is already inactive');
    }

    await this.creditLimitRepository.update(limitId, {
      status: CreditLimitStatus.SUSPENDED,
      isActive: false,
      updatedAt: new Date(),
      updatedBy: suspendedBy
    });

    // Create history entry
    await this.creditLimitRepository.createHistory({
      creditLimitId: limitId,
      customerId: limit.customerId,
      previousAmount: limit.amount,
      newAmount: limit.amount,
      changeType: 'SUSPENSION',
      changedBy: suspendedBy,
      changedAt: new Date(),
      changeReason: `Credit limit suspended: ${reason}`
    });
  }

  async reinstateCreditLimit(limitId: string, reinstatedBy: string, reason: string): Promise<void> {
    const limit = await this.creditLimitRepository.findById(limitId);
    if (!limit) {
      throw new NotFoundError('CreditLimit', limitId); // FIXED: Added resourceType
    }

    if (limit.status !== CreditLimitStatus.SUSPENDED) {
      throw new BusinessRuleError(`Credit limit is not suspended (current: ${limit.status})`);
    }

    await this.creditLimitRepository.update(limitId, {
      status: CreditLimitStatus.ACTIVE,
      isActive: true,
      updatedAt: new Date(),
      updatedBy: reinstatedBy
    });

    // Create history entry
    await this.creditLimitRepository.createHistory({
      creditLimitId: limitId,
      customerId: limit.customerId,
      previousAmount: limit.amount,
      newAmount: limit.amount,
      changeType: 'REINSTATEMENT',
      changedBy: reinstatedBy,
      changedAt: new Date(),
      changeReason: `Credit limit reinstated: ${reason}`
    });
  }

  async updateCreditLimit(limitId: string, newAmount: number, changedBy: string, reason: string): Promise<CreditLimit> {
    const limit = await this.creditLimitRepository.findById(limitId);
    if (!limit) {
      throw new NotFoundError('CreditLimit', limitId); // FIXED: Added resourceType
    }

    if (!limit.isActive) {
      throw new BusinessRuleError('Cannot update inactive credit limit');
    }

    // Check if amount is within system limits
    const settings = await this.getCreditSettings();
    if (newAmount > settings.maximumCreditLimit) {
      throw new BusinessRuleError(`New amount exceeds maximum limit of ${settings.maximumCreditLimit}`);
    }

    // Check if decrease would cause current balance to exceed new limit
    const balance = await this.balanceRepository.findByCustomerId(limit.customerId);
    if (balance && newAmount < balance.currentBalance) {
      throw new BusinessRuleError(`New credit limit cannot be less than current balance (${balance.currentBalance})`);
    }

    // Create history entry
    await this.creditLimitRepository.createHistory({
      creditLimitId: limitId,
      customerId: limit.customerId,
      previousAmount: limit.amount,
      newAmount,
      changeType: newAmount > limit.amount ? 'INCREASE' : 'DECREASE',
      changedBy,
      changedAt: new Date(),
      changeReason: reason
    });

    // Update limit
    const updatedLimit = await this.creditLimitRepository.update(limitId, {
      amount: newAmount,
      availableCredit: newAmount - (limit.amount - limit.availableCredit),
      updatedAt: new Date(),
      updatedBy: changedBy
    });

    // Update customer balance record
    if (balance) {
      await this.balanceRepository.update(balance.id, {
        creditLimit: newAmount,
        availableBalance: newAmount - balance.currentBalance,
        lastUpdated: new Date(),
        updatedBy: changedBy,
        version: balance.version + 1
      });
    }

    return updatedLimit;
  }

  async validateCreditForTransaction(customerId: string, transactionAmount: number): Promise<CreditLimitValidation> {
    const limit = await this.creditLimitRepository.findActiveByCustomerId(customerId);
    const balance = await this.balanceRepository.findByCustomerId(customerId);
    
    const validation: CreditLimitValidation = {
      isValid: true,
      errors: [],
      warnings: [],
      riskLevel: 'LOW',
      riskScore: 0
    };

    if (!limit) {
      validation.isValid = false;
      validation.errors.push('No active credit limit found');
      validation.riskLevel = 'HIGH';
      validation.riskScore = 100;
      return validation;
    }

    if (!balance) {
      validation.isValid = false;
      validation.errors.push('No balance record found');
      validation.riskLevel = 'HIGH';
      validation.riskScore = 100;
      return validation;
    }

    // Calculate new balance after transaction
    const newBalance = balance.currentBalance + transactionAmount;
    const availableCredit = limit.amount - newBalance;

    // Check if transaction exceeds credit limit
    if (newBalance > limit.amount) {
      validation.isValid = false;
      validation.errors.push(`Transaction would exceed credit limit by ${newBalance - limit.amount}`);
      validation.riskLevel = 'HIGH';
      validation.riskScore += 40;
    }

    // Check utilization threshold
    const utilization = (newBalance / limit.amount) * 100;
    if (utilization > 90) {
      validation.warnings.push(`High credit utilization (${utilization.toFixed(1)}%)`);
      validation.riskLevel = 'MEDIUM';
      validation.riskScore += 20;
    } else if (utilization > 80) {
      validation.warnings.push(`Credit utilization approaching limit (${utilization.toFixed(1)}%)`);
      validation.riskLevel = 'MEDIUM';
      validation.riskScore += 10;
    }

    // Check if customer has overdue payments
    if (balance.isOverdue) {
      validation.warnings.push('Customer has overdue payments');
      validation.riskLevel = 'HIGH';
      validation.riskScore += 30;
    }

    // Calculate risk score (0-100)
    validation.riskScore = Math.min(100, validation.riskScore);

    // Set risk level based on score
    if (validation.riskScore >= 70) {
      validation.riskLevel = 'HIGH';
    } else if (validation.riskScore >= 30) {
      validation.riskLevel = 'MEDIUM';
    } else {
      validation.riskLevel = 'LOW';
    }

    // Provide recommendations
    if (!validation.isValid) {
      validation.suggestions = [
        'Request partial payment before transaction',
        'Consider reducing transaction amount',
        'Review customer credit history'
      ];
    } else if (validation.warnings.length > 0) {
      validation.suggestions = [
        'Monitor credit utilization closely',
        'Consider requesting payment on account'
      ];
    }

    return validation;
  }

  async checkCreditLimit(customerId: string, amount: number): Promise<{ allowed: boolean; availableCredit: number; reason?: string }> {
    const validation = await this.validateCreditForTransaction(customerId, amount);
    
    return {
      allowed: validation.isValid,
      availableCredit: await this.getAvailableCredit(customerId),
      reason: validation.errors.length > 0 ? validation.errors[0] : undefined
    };
  }

  async calculateCreditScore(customerId: string): Promise<number> {
    const customer = await this.customerRepository.findById(customerId);
    if (!customer) {
      throw new NotFoundError('Customer', customerId); // FIXED: Added resourceType
    }

    const balance = await this.balanceRepository.findByCustomerId(customerId);
    const transactions = await this.transactionRepository.findByCustomerId(customerId, 1, 100);
    const limit = await this.creditLimitRepository.findActiveByCustomerId(customerId);

    let score = 50; // Base score

    // Payment history (40% of score)
    if (transactions.transactions.length > 0) {
      const paymentTransactions = transactions.transactions.filter(t => 
        t.type === TransactionType.PAYMENT && t.dueDate
      );
      
      if (paymentTransactions.length > 0) {
        let onTimePayments = 0;
        paymentTransactions.forEach(t => {
          if (t.transactionDate <= t.dueDate!) {
            onTimePayments++;
          }
        });
        
        const onTimePercentage = (onTimePayments / paymentTransactions.length) * 100;
        score += (onTimePercentage * 0.4) - 20; // Adjust for 40% weight
      }
    }

    // Credit utilization (30% of score)
    if (limit && balance) {
      const utilization = (balance.currentBalance / limit.amount) * 100;
      if (utilization <= 30) {
        score += 30; // Excellent utilization
      } else if (utilization <= 50) {
        score += 20; // Good utilization
      } else if (utilization <= 75) {
        score += 10; // Fair utilization
      } else if (utilization <= 90) {
        score -= 10; // Poor utilization
      } else {
        score -= 20; // Very poor utilization
      }
    }

    // Length of credit history (15% of score)
    const customerAge = new Date().getTime() - customer.createdAt.getTime();
    const customerAgeInYears = customerAge / (1000 * 60 * 60 * 24 * 365);
    
    if (customerAgeInYears > 5) {
      score += 15;
    } else if (customerAgeInYears > 3) {
      score += 10;
    } else if (customerAgeInYears > 1) {
      score += 5;
    }

    // Recent credit activity (15% of score)
    if (transactions.transactions.length > 0) {
      const recentTransactions = transactions.transactions.filter(t => 
        t.transactionDate > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      );
      
      if (recentTransactions.length > 10) {
        score -= 10; // Too many recent transactions
      } else if (recentTransactions.length > 5) {
        score -= 5; // Many recent transactions
      } else if (recentTransactions.length > 0) {
        score += 5; // Some recent activity
      }
    }

    // Adjust for overdue status
    if (balance?.isOverdue) {
      score -= 20;
    }

    // Cap score between 300 and 850 (common credit score range)
    score = Math.max(300, Math.min(850, score));

    return Math.round(score);
  }

  async submitCreditLimitChangeRequest(request: Omit<CreditLimitChangeRequest, 'id'>): Promise<CreditLimitChangeRequest> {
    const limit = await this.creditLimitRepository.findActiveByCustomerId(request.customerId);
    if (!limit) {
      throw NotFoundError.creditLimit('active'); // FIXED: Using static method
    }

    // Validate new amount
    const settings = await this.getCreditSettings();
    if (request.newAmount > settings.maximumCreditLimit) {
      throw new BusinessRuleError(`Requested amount exceeds maximum limit of ${settings.maximumCreditLimit}`);
    }

    // Check if decrease would cause issues
    const balance = await this.balanceRepository.findByCustomerId(request.customerId);
    if (balance && request.newAmount < balance.currentBalance) {
      throw new BusinessRuleError(`New credit limit cannot be less than current balance (${balance.currentBalance})`);
    }

    const changeRequest: CreditLimitChangeRequest = {
      id: '',
      ...request,
      status: 'PENDING'
    };

    // Save the request (implementation depends on repository)
    // This is a simplified version - you would need a repository for change requests
    return changeRequest;
  }

  async approveCreditLimitChange(requestId: string, approvedBy: string, notes?: string): Promise<CreditLimit> {
    // Implementation would depend on your change request repository
    // This is a simplified version
    throw new Error('Not implemented - requires CreditLimitChangeRequest repository');
  }

  async rejectCreditLimitChange(requestId: string, rejectedBy: string, reason: string): Promise<void> {
    // Implementation would depend on your change request repository
    // This is a simplified version
    throw new Error('Not implemented - requires CreditLimitChangeRequest repository');
  }

  async getCreditUtilization(customerId: string): Promise<CreditLimitUtilization> {
    const limit = await this.creditLimitRepository.findActiveByCustomerId(customerId);
    const balance = await this.balanceRepository.findByCustomerId(customerId);
    const customer = await this.customerRepository.findById(customerId);

    if (!limit || !balance || !customer) {
      throw NotFoundError.customerBalance(customerId); // FIXED: Using static method
    }

    const utilization = (balance.currentBalance / limit.amount) * 100;

    return {
      customerId,
      customerName: customer.name,
      creditLimit: limit.amount,
      currentBalance: balance.currentBalance,
      availableCredit: limit.availableCredit,
      utilizationPercentage: utilization,
      isOverLimit: balance.currentBalance > limit.amount,
      isNearLimit: utilization > 80,
      hasOverduePayments: balance.isOverdue,
      utilizationTrend: await this.getUtilizationTrend(customerId),
      lastChangeDate: limit.updatedAt,
      alerts: await this.generateCreditAlerts(customerId, limit, balance)
    };
  }

  async getHighUtilizationCustomers(threshold: number): Promise<CreditLimitUtilization[]> {
    const customers = await this.customerRepository.findAllActive();
    const highUtilization: CreditLimitUtilization[] = [];

    for (const customer of customers) {
      try {
        const utilization = await this.getCreditUtilization(customer.id);
        if (utilization.utilizationPercentage >= threshold) {
          highUtilization.push(utilization);
        }
      } catch (error) {
        // Skip customers without credit limits
        continue;
      }
    }

    return highUtilization.sort((a, b) => b.utilizationPercentage - a.utilizationPercentage);
  }

  async getCreditLimitHistory(customerId: string): Promise<CreditLimitHistory[]> {
    return this.creditLimitRepository.getHistoryByCustomerId(customerId);
  }

  async getCreditSettings(): Promise<CreditLimitSettings> {
    // This would typically come from a settings repository or database
    // Returning default settings for now
    return {
      defaultCreditLimit: 10000,
      maximumCreditLimit: 100000,
      minimumCreditLimit: 1000,
      autoApproveThreshold: 5000,
      managerApprovalThreshold: 20000,
      adminApprovalThreshold: 50000,
      highRiskThreshold: 90,
      mediumRiskThreshold: 70,
      periodicReviewDays: 90,
      creditCheckRequired: true,
      notifyOnHighUtilization: true,
      highUtilizationThreshold: 80,
      notifyOnLimitChange: true
    };
  }

  async updateCreditSettings(settings: Partial<CreditLimitSettings>, updatedBy: string): Promise<CreditLimitSettings> {
    // This would typically save to a settings repository or database
    // For now, just return the updated settings
    const current = await this.getCreditSettings();
    const updated = { ...current, ...settings };
    
    // Validate settings
    if (updated.maximumCreditLimit < updated.minimumCreditLimit) {
      throw new BusinessRuleError('Maximum credit limit cannot be less than minimum limit');
    }

    if (updated.autoApproveThreshold > updated.managerApprovalThreshold) {
      throw new BusinessRuleError('Auto-approve threshold cannot exceed manager approval threshold');
    }

    if (updated.managerApprovalThreshold > updated.adminApprovalThreshold) {
      throw new BusinessRuleError('Manager approval threshold cannot exceed admin approval threshold');
    }

    return updated;
  }

  async createCreditOverride(customerId: string, amount: number, overrideBy: string, reason: string, expiryDate?: Date): Promise<CreditLimit> {
    // Check if override authority exists
    if (!this.isManager(overrideBy) && !this.isAdmin(overrideBy)) {
      throw new BusinessRuleError('Only managers or admins can create credit overrides');
    }

    const existingLimit = await this.creditLimitRepository.findActiveByCustomerId(customerId);
    
    if (!existingLimit) {
      throw NotFoundError.creditLimit('active'); // FIXED: Using static method
    }

    // Create temporary override limit
    const overrideLimit: Omit<CreditLimit, 'id'> = {
      customerId,
      amount: existingLimit.amount + amount,
      currency: existingLimit.currency,
      validFrom: new Date(),
      validTo: expiryDate,
      paymentTerms: existingLimit.paymentTerms,
      interestRate: existingLimit.interestRate,
      gracePeriod: existingLimit.gracePeriod,
      status: CreditLimitStatus.ACTIVE,
      isActive: true,
      requiresApproval: false,
      approvalLevel: 'MANAGER',
      currentUtilization: existingLimit.currentUtilization,
      availableCredit: existingLimit.availableCredit + amount,
      createdBy: overrideBy,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const createdOverride = await this.creditLimitRepository.create(overrideLimit);

    // Create history entry
    await this.creditLimitRepository.createHistory({
      creditLimitId: createdOverride.id,
      customerId,
      previousAmount: existingLimit.amount,
      newAmount: existingLimit.amount + amount,
      changeType: 'OVERRIDE',
      changedBy: overrideBy,
      changedAt: new Date(),
      changeReason: `Credit override: ${reason}`
    });

    return createdOverride;
  }

  async validateOverride(customerId: string, overrideId: string): Promise<boolean> {
    const override = await this.creditLimitRepository.findById(overrideId);
    
    if (!override || override.customerId !== customerId) {
      return false;
    }

    // Check if override is still valid
    if (override.validTo && override.validTo < new Date()) {
      return false;
    }

    return override.isActive && override.status === CreditLimitStatus.ACTIVE;
  }

  async assessCreditRisk(customerId: string): Promise<{
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    riskScore: number;
    factors: string[];
    recommendations: string[];
  }> {
    const creditScore = await this.calculateCreditScore(customerId);
    const utilization = await this.getCreditUtilization(customerId);
    const balance = await this.balanceRepository.findByCustomerId(customerId);

    const factors: string[] = [];
    let riskScore = 0;

    // Credit score factor
    if (creditScore < 500) {
      factors.push('Low credit score');
      riskScore += 40;
    } else if (creditScore < 650) {
      factors.push('Moderate credit score');
      riskScore += 20;
    }

    // Utilization factor
    if (utilization.utilizationPercentage > 90) {
      factors.push('Very high credit utilization');
      riskScore += 30;
    } else if (utilization.utilizationPercentage > 75) {
      factors.push('High credit utilization');
      riskScore += 20;
    }

    // Overdue factor
    if (balance?.isOverdue) {
      factors.push('Overdue payments');
      riskScore += 25;
    }

    // Payment history factor (simplified)
    const transactions = await this.transactionRepository.findByCustomerId(customerId, 1, 100);
    const latePayments = transactions.transactions.filter(t => 
      t.type === TransactionType.PAYMENT && t.dueDate && t.transactionDate > t.dueDate
    ).length;

    if (latePayments > 3) {
      factors.push('Multiple late payments');
      riskScore += 15;
    } else if (latePayments > 0) {
      factors.push('Some late payments');
      riskScore += 10;
    }

    // Determine risk level
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    if (riskScore >= 70) {
      riskLevel = 'HIGH';
    } else if (riskScore >= 40) {
      riskLevel = 'MEDIUM';
    }

    // Generate recommendations
    const recommendations: string[] = [];
    if (utilization.utilizationPercentage > 75) {
      recommendations.push('Consider reducing credit limit or requesting payment');
    }
    if (balance?.isOverdue) {
      recommendations.push('Follow up on overdue payments immediately');
    }
    if (creditScore < 600) {
      recommendations.push('Require additional security or guarantees');
    }
    if (riskLevel === 'HIGH') {
      recommendations.push('Review account more frequently (weekly)');
      recommendations.push('Consider suspending further credit');
    }

    return {
      riskLevel,
      riskScore: Math.min(100, riskScore),
      factors,
      recommendations
    };
  }

  async performCreditReview(customerId: string, reviewedBy: string): Promise<{
    currentLimit: number;
    recommendedLimit: number;
    reviewNotes: string;
    nextReviewDate: Date;
  }> {
    const limit = await this.creditLimitRepository.findActiveByCustomerId(customerId);
    if (!limit) {
      throw NotFoundError.creditLimit('active'); // FIXED: Using static method
    }

    const creditScore = await this.calculateCreditScore(customerId);
    const utilization = await this.getCreditUtilization(customerId);
    const riskAssessment = await this.assessCreditRisk(customerId);

    let recommendedLimit = limit.amount;
    const reviewNotes: string[] = [];

    // Adjust limit based on credit score
    if (creditScore > 750 && utilization.utilizationPercentage < 50) {
      recommendedLimit = Math.min(limit.amount * 1.5, (await this.getCreditSettings()).maximumCreditLimit);
      reviewNotes.push('Excellent credit score and low utilization - consider increase');
    } else if (creditScore < 550 || utilization.utilizationPercentage > 90) {
      recommendedLimit = Math.max(limit.amount * 0.7, (await this.getCreditSettings()).minimumCreditLimit);
      reviewNotes.push('Poor credit score or high utilization - consider decrease');
    }

    // Add risk factors to notes
    if (riskAssessment.factors.length > 0) {
      reviewNotes.push(`Risk factors: ${riskAssessment.factors.join(', ')}`);
    }

    // Calculate next review date
    const nextReviewDate = new Date();
    const settings = await this.getCreditSettings();
    nextReviewDate.setDate(nextReviewDate.getDate() + settings.periodicReviewDays);

    return {
      currentLimit: limit.amount,
      recommendedLimit,
      reviewNotes: reviewNotes.join('. '),
      nextReviewDate
    };
  }

  private async getAvailableCredit(customerId: string): Promise<number> {
    const limit = await this.creditLimitRepository.findActiveByCustomerId(customerId);
    const balance = await this.balanceRepository.findByCustomerId(customerId);

    if (!limit || !balance) {
      return 0;
    }

    return Math.max(0, limit.amount - balance.currentBalance);
  }

  private async getUtilizationTrend(customerId: string): Promise<'INCREASING' | 'DECREASING' | 'STABLE'> {
    // Get transactions from last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const transactions = await this.transactionRepository.findByCustomerIdAndDate(customerId, thirtyDaysAgo, new Date());

    if (transactions.length < 2) {
      return 'STABLE';
    }

    // Calculate average daily balance change
    let totalChange = 0;
    for (let i = 1; i < transactions.length; i++) {
      const change = transactions[i].balanceAfter - transactions[i - 1].balanceAfter;
      totalChange += change;
    }

    const averageDailyChange = totalChange / (transactions.length - 1);

    if (averageDailyChange > 100) {
      return 'INCREASING';
    } else if (averageDailyChange < -100) {
      return 'DECREASING';
    } else {
      return 'STABLE';
    }
  }

  private async generateCreditAlerts(customerId: string, limit: CreditLimit, balance: CustomerBalance): Promise<string[]> {
    const alerts: string[] = [];
    const utilization = (balance.currentBalance / limit.amount) * 100;

    if (utilization > 90) {
      alerts.push('CRITICAL: Credit utilization over 90%');
    } else if (utilization > 80) {
      alerts.push('WARNING: Credit utilization over 80%');
    }

    if (balance.currentBalance > limit.amount) {
      alerts.push('CRITICAL: Credit limit exceeded');
    }

    if (balance.isOverdue) {
      alerts.push('WARNING: Account has overdue payments');
    }

    // Check if limit is expiring soon
    if (limit.validTo) {
      const daysUntilExpiry = Math.ceil((limit.validTo.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntilExpiry <= 7) {
        alerts.push(`NOTICE: Credit limit expires in ${daysUntilExpiry} days`);
      }
    }

    return alerts;
  }

  private isManager(userId: string): boolean {
    // This would check user's role in your system
    // Simplified for now
    return true; // Assume true for demonstration
  }

  private isAdmin(userId: string): boolean {
    // This would check user's role in your system
    // Simplified for now
    return true; // Assume true for demonstration
  }
}