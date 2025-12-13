// packages/core/src/services/CreditValidationService.ts
import { CreditLimit, CreditLimitStatus, CreditLimitValidation } from '../domain/CreditLimit';
import { CustomerBalance, BalanceAgeAnalysis } from '../domain/CustomerBalance';
import { Transaction, TransactionType } from '../domain/Transaction';
import { Customer, CustomerStatus } from '../domain/Customer';
import { ValidationError, BusinessRuleError, NotFoundError } from '../errors/ApplicationError';

// Repository interfaces (these would typically be imported from actual files)
interface ICreditLimitRepository {
  findActiveByCustomerId(customerId: string): Promise<CreditLimit | null>;
}

interface ICustomerBalanceRepository {
  findByCustomerId(customerId: string): Promise<CustomerBalance | null>;
}

interface ITransactionRepository {
  findByCustomerId(customerId: string, page: number, limit: number): Promise<{ transactions: Transaction[], total: number }>;
  findRecentTransactions(customerId: string, days: number): Promise<Transaction[]>;
}

interface ICustomerRepository {
  findById(id: string): Promise<Customer | null>;
}

export interface ICreditValidationService {
  // Transaction validation
  validateTransaction(customerId: string, amount: number, transactionType: TransactionType): Promise<CreditLimitValidation>;
  canProcessTransaction(customerId: string, amount: number): Promise<{ allowed: boolean; reason?: string; availableCredit?: number }>;
  
  // Credit limit validation
  validateCreditLimitApplication(customerId: string, requestedAmount: number): Promise<CreditLimitValidation>;
  validateCreditLimitIncrease(customerId: string, currentLimit: number, newAmount: number): Promise<CreditLimitValidation>;
  
  // Customer eligibility
  isCustomerCreditEligible(customerId: string): Promise<{ eligible: boolean; reasons: string[] }>;
  calculateCreditEligibilityScore(customerId: string): Promise<number>;
  
  // Risk assessment
  assessTransactionRisk(customerId: string, amount: number, transactionType: TransactionType): Promise<{
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    riskScore: number;
    riskFactors: string[];
    recommendations: string[];
  }>;
  
  // Override validation
  validateManagerOverride(customerId: string, amount: number, overrideReason?: string): Promise<{
    allowed: boolean;
    requiresApproval: boolean;
    approvalLevel: 'MANAGER' | 'ADMIN';
    conditions: string[];
  }>;
  
  // Payment validation
  validatePayment(customerId: string, paymentAmount: number): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
    suggestedAmount?: number;
  }>;
  
  // Bulk validation
  validateMultipleTransactions(customerIds: string[], amounts: number[]): Promise<Map<string, CreditLimitValidation>>;
  
  // Compliance checks
  checkRegulatoryCompliance(customerId: string, transactionAmount: number): Promise<{
    compliant: boolean;
    requirements: string[];
    violations: string[];
  }>;
}

export class CreditValidationService implements ICreditValidationService {
  constructor(
    private creditLimitRepository: ICreditLimitRepository,
    private balanceRepository: ICustomerBalanceRepository,
    private transactionRepository: ITransactionRepository,
    private customerRepository: ICustomerRepository
  ) {}

  async validateTransaction(customerId: string, amount: number, transactionType: TransactionType): Promise<CreditLimitValidation> {
    const validation: CreditLimitValidation = {
      isValid: true,
      errors: [],
      warnings: [],
      riskLevel: 'LOW',
      riskScore: 0
    };

    // 1. Basic validation
    if (amount <= 0) {
      validation.isValid = false;
      validation.errors.push('Transaction amount must be positive');
      return validation;
    }

    // 2. Check customer status
    const customer = await this.customerRepository.findById(customerId);
    if (!customer) {
      validation.isValid = false;
      validation.errors.push('Customer not found');
      validation.riskLevel = 'HIGH';
      validation.riskScore = 100;
      return validation;
    }

    if (customer.status !== CustomerStatus.ACTIVE) {
      validation.isValid = false;
      validation.errors.push(`Customer is ${customer.status.toLowerCase()}`);
      validation.riskLevel = 'HIGH';
      validation.riskScore = 80;
      return validation;
    }

    // 3. Check credit limit
    const creditLimit = await this.creditLimitRepository.findActiveByCustomerId(customerId);
    if (!creditLimit) {
      validation.isValid = false;
      validation.errors.push('No active credit limit');
      validation.riskLevel = 'HIGH';
      validation.riskScore = 70;
      return validation;
    }

    if (!creditLimit.isActive || creditLimit.status !== CreditLimitStatus.ACTIVE) {
      validation.isValid = false;
      validation.errors.push(`Credit limit is ${creditLimit.status.toLowerCase()}`);
      validation.riskLevel = 'HIGH';
      validation.riskScore = 80;
      return validation;
    }

    // 4. Check balance
    const balance = await this.balanceRepository.findByCustomerId(customerId);
    if (!balance) {
      validation.isValid = false;
      validation.errors.push('Balance record not found');
      validation.riskLevel = 'HIGH';
      validation.riskScore = 90;
      return validation;
    }

    // 5. Calculate new balance
    let newBalance = balance.currentBalance;
    if (this.isDebitTransaction(transactionType)) {
      newBalance += amount;
    }

    // 6. Check if transaction exceeds credit limit
    if (newBalance > creditLimit.amount) {
      const exceededBy = newBalance - creditLimit.amount;
      validation.isValid = false;
      validation.errors.push(`Transaction would exceed credit limit by ${exceededBy.toFixed(2)}`);
      validation.riskLevel = 'HIGH';
      validation.riskScore += 40;
    }

    // 7. Check utilization
    const currentUtilization = (balance.currentBalance / creditLimit.amount) * 100;
    const newUtilization = (newBalance / creditLimit.amount) * 100;

    if (newUtilization > 90) {
      validation.warnings.push(`High credit utilization: ${newUtilization.toFixed(1)}%`);
      validation.riskLevel = 'HIGH';
      validation.riskScore += 30;
    } else if (newUtilization > 80) {
      validation.warnings.push(`Credit utilization approaching limit: ${newUtilization.toFixed(1)}%`);
      validation.riskLevel = 'MEDIUM';
      validation.riskScore += 20;
    } else if (newUtilization > 70) {
      validation.warnings.push(`Moderate credit utilization: ${newUtilization.toFixed(1)}%`);
      validation.riskLevel = 'MEDIUM';
      validation.riskScore += 10;
    }

    // 8. Check for overdue payments
    if (balance.isOverdue) {
      validation.warnings.push('Customer has overdue payments');
      validation.riskLevel = 'HIGH';
      validation.riskScore += 25;
    }

    // 9. Check aging analysis
    const agingRisk = this.assessAgingRisk(balance.ageAnalysis);
    if (agingRisk.riskLevel !== 'LOW') {
      validation.warnings.push(agingRisk.message);
      validation.riskLevel = this.getHigherRiskLevel(validation.riskLevel, agingRisk.riskLevel);
      validation.riskScore += agingRisk.riskScore;
    }

    // 10. Check transaction pattern
    const patternRisk = await this.assessTransactionPattern(customerId, amount, transactionType);
    if (patternRisk.riskLevel !== 'LOW') {
      validation.warnings.push(patternRisk.message);
      validation.riskLevel = this.getHigherRiskLevel(validation.riskLevel, patternRisk.riskLevel);
      validation.riskScore += patternRisk.riskScore;
    }

    // 11. Check large transaction
    if (this.isLargeTransaction(amount, creditLimit.amount)) {
      validation.warnings.push('Large transaction detected');
      validation.riskLevel = this.getHigherRiskLevel(validation.riskLevel, 'MEDIUM');
      validation.riskScore += 15;
    }

    // 12. Calculate final risk score and adjust
    validation.riskScore = Math.min(100, Math.round(validation.riskScore));

    // Update risk level based on final score
    if (validation.riskScore >= 70) {
      validation.riskLevel = 'HIGH';
    } else if (validation.riskScore >= 40) {
      validation.riskLevel = 'MEDIUM';
    } else {
      validation.riskLevel = 'LOW';
    }

    // 13. Provide recommendations
    if (!validation.isValid) {
      validation.suggestions = [
        'Request partial payment before transaction',
        'Consider reducing transaction amount',
        'Review customer credit history'
      ];
    } else if (validation.warnings.length > 0) {
      validation.suggestions = [
        'Monitor transaction closely',
        'Consider requesting additional security',
        'Review customer payment patterns'
      ];
    }

    // 14. For high-risk transactions, add special conditions
    if (validation.riskLevel === 'HIGH' && validation.isValid) {
      validation.suggestions = validation.suggestions || [];
      validation.suggestions.push('Require manager approval');
      validation.suggestions.push('Consider requesting advance payment');
    }

    return validation;
  }

  async canProcessTransaction(customerId: string, amount: number): Promise<{ allowed: boolean; reason?: string; availableCredit?: number }> {
    const validation = await this.validateTransaction(customerId, amount, TransactionType.SALE);
    
    if (!validation.isValid) {
      return {
        allowed: false,
        reason: validation.errors[0] || 'Transaction validation failed',
        availableCredit: await this.calculateAvailableCredit(customerId)
      };
    }

    // Even if technically valid, check risk level
    if (validation.riskLevel === 'HIGH') {
      return {
        allowed: false,
        reason: 'High-risk transaction requires manual approval',
        availableCredit: await this.calculateAvailableCredit(customerId)
      };
    }

    return {
      allowed: true,
      availableCredit: await this.calculateAvailableCredit(customerId)
    };
  }

  async validateCreditLimitApplication(customerId: string, requestedAmount: number): Promise<CreditLimitValidation> {
    const validation: CreditLimitValidation = {
      isValid: true,
      errors: [],
      warnings: [],
      riskLevel: 'LOW',
      riskScore: 0
    };

    // 1. Check if customer already has a limit
    const existingLimit = await this.creditLimitRepository.findActiveByCustomerId(customerId);
    if (existingLimit) {
      validation.isValid = false;
      validation.errors.push('Customer already has an active credit limit');
      return validation;
    }

    // 2. Check customer eligibility
    const eligibility = await this.isCustomerCreditEligible(customerId);
    if (!eligibility.eligible) {
      validation.isValid = false;
      validation.errors.push(...eligibility.reasons);
      validation.riskLevel = 'HIGH';
      validation.riskScore = 100;
      return validation;
    }

    // 3. Validate requested amount
    if (requestedAmount <= 0) {
      validation.isValid = false;
      validation.errors.push('Credit limit amount must be positive');
      return validation;
    }

    // 4. Check system limits (these would come from settings)
    const systemMaxLimit = 100000; // Example system limit
    const systemMinLimit = 1000;   // Example minimum limit
    
    if (requestedAmount > systemMaxLimit) {
      validation.isValid = false;
      validation.errors.push(`Requested amount exceeds maximum system limit of ${systemMaxLimit}`);
      validation.recommendedLimit = systemMaxLimit;
    }

    if (requestedAmount < systemMinLimit) {
      validation.isValid = false;
      validation.errors.push(`Requested amount is below minimum system limit of ${systemMinLimit}`);
      validation.recommendedLimit = systemMinLimit;
    }

    // 5. Calculate credit score
    const creditScore = await this.calculateCreditEligibilityScore(customerId);
    validation.riskScore = 100 - creditScore; // Invert score for risk

    // 6. Set risk level based on score
    if (creditScore < 50) {
      validation.riskLevel = 'HIGH';
      validation.warnings.push('Low credit eligibility score');
    } else if (creditScore < 70) {
      validation.riskLevel = 'MEDIUM';
      validation.warnings.push('Moderate credit eligibility score');
    }

    // 7. Provide recommendations
    if (validation.riskLevel === 'HIGH') {
      validation.suggestions = [
        'Consider starting with a lower credit limit',
        'Request additional collateral or guarantees',
        'Implement stricter payment terms'
      ];
    } else if (validation.riskLevel === 'MEDIUM') {
      validation.suggestions = [
        'Monitor account activity closely',
        'Consider gradual limit increases based on performance',
        'Implement standard payment terms'
      ];
    }

    return validation;
  }

  async validateCreditLimitIncrease(customerId: string, currentLimit: number, newAmount: number): Promise<CreditLimitValidation> {
    const validation: CreditLimitValidation = {
      isValid: true,
      errors: [],
      warnings: [],
      riskLevel: 'LOW',
      riskScore: 0
    };

    // 1. Basic validation
    if (newAmount <= currentLimit) {
      validation.isValid = false;
      validation.errors.push('New amount must be greater than current limit');
      return validation;
    }

    const increaseAmount = newAmount - currentLimit;
    const increasePercentage = ((newAmount - currentLimit) / currentLimit) * 100;

    // 2. Check increase percentage
    if (increasePercentage > 50) {
      validation.warnings.push(`Large increase requested: ${increasePercentage.toFixed(1)}%`);
      validation.riskLevel = 'MEDIUM';
      validation.riskScore += 20;
    }

    // 3. Check customer payment history
    const paymentHistory = await this.analyzePaymentHistory(customerId);
    if (paymentHistory.latePaymentRate > 0.3) { // More than 30% late payments
      validation.isValid = false;
      validation.errors.push('Poor payment history');
      validation.riskLevel = 'HIGH';
      validation.riskScore += 40;
    }

    // 4. Check current utilization
    const balance = await this.balanceRepository.findByCustomerId(customerId);
    if (balance) {
      const currentUtilization = (balance.currentBalance / currentLimit) * 100;
      if (currentUtilization > 80) {
        validation.warnings.push(`High current utilization: ${currentUtilization.toFixed(1)}%`);
        validation.riskLevel = this.getHigherRiskLevel(validation.riskLevel, 'MEDIUM');
        validation.riskScore += 15;
      }
    }

    // 5. Check for overdue payments
    if (balance?.isOverdue) {
      validation.isValid = false;
      validation.errors.push('Customer has overdue payments');
      validation.riskLevel = 'HIGH';
      validation.riskScore += 30;
    }

    // 6. Provide recommendations
    if (!validation.isValid) {
      validation.suggestions = [
        'Address overdue payments first',
        'Consider smaller incremental increases',
        'Review customer credit report'
      ];
    } else if (validation.warnings.length > 0) {
      validation.suggestions = [
        'Consider phased increase approach',
        'Implement additional monitoring',
        'Review after 3 months of good payment history'
      ];
    }

    return validation;
  }

  async isCustomerCreditEligible(customerId: string): Promise<{ eligible: boolean; reasons: string[] }> {
    const reasons: string[] = [];
    let eligible = true;

    // 1. Check customer status
    const customer = await this.customerRepository.findById(customerId);
    if (!customer) {
      reasons.push('Customer not found');
      return { eligible: false, reasons };
    }

    if (customer.status !== CustomerStatus.ACTIVE) {
      reasons.push(`Customer status is ${customer.status}`);
      eligible = false;
    }

    // 2. Check customer age (time as customer)
    const customerAgeInDays = (new Date().getTime() - customer.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    if (customerAgeInDays < 30) {
      reasons.push('Customer is new (less than 30 days)');
      // New customers might still be eligible, just note it
    }

    // 3. Check for existing credit issues
    const balance = await this.balanceRepository.findByCustomerId(customerId);
    if (balance) {
      if (balance.isOverdue) {
        reasons.push('Customer has overdue payments');
        eligible = false;
      }

      if (balance.ageAnalysis.over180 > 0) {
        reasons.push('Customer has very old outstanding balances');
        eligible = false;
      }
    }

    // 4. Check transaction history
    const { transactions } = await this.transactionRepository.findByCustomerId(customerId, 1, 100);
    if (transactions.length === 0) {
      reasons.push('No transaction history');
      // Might still be eligible for initial limit
    }

    return { eligible, reasons };
  }

  async calculateCreditEligibilityScore(customerId: string): Promise<number> {
    let score = 50; // Base score

    const customer = await this.customerRepository.findById(customerId);
    if (!customer) {
      return 0;
    }

    // 1. Customer longevity (20 points)
    const customerAgeInDays = (new Date().getTime() - customer.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    if (customerAgeInDays > 365) {
      score += 20;
    } else if (customerAgeInDays > 180) {
      score += 15;
    } else if (customerAgeInDays > 90) {
      score += 10;
    } else if (customerAgeInDays > 30) {
      score += 5;
    }

    // 2. Payment history (30 points)
    const paymentHistory = await this.analyzePaymentHistory(customerId);
    if (paymentHistory.totalPayments > 0) {
      const onTimeRate = 1 - paymentHistory.latePaymentRate;
      score += onTimeRate * 30;
    }

    // 3. Transaction volume (20 points)
    const { transactions } = await this.transactionRepository.findByCustomerId(customerId, 1, 1000);
    const totalTransactionValue = transactions.reduce((sum, t) => sum + t.amount, 0);
    
    if (totalTransactionValue > 100000) {
      score += 20;
    } else if (totalTransactionValue > 50000) {
      score += 15;
    } else if (totalTransactionValue > 10000) {
      score += 10;
    } else if (totalTransactionValue > 1000) {
      score += 5;
    }

    // 4. Balance status (15 points)
    const balance = await this.balanceRepository.findByCustomerId(customerId);
    if (balance) {
      if (!balance.isOverdue && balance.currentBalance === 0) {
        score += 15;
      } else if (!balance.isOverdue && balance.currentBalance < 1000) {
        score += 10;
      } else if (!balance.isOverdue) {
        score += 5;
      }
    }

    // 5. Customer type (15 points)
    if (customer.type === 'COMPANY') {
      score += 15;
    } else if (customer.type === 'INDIVIDUAL' && customer.companyName) {
      score += 10;
    } else {
      score += 5;
    }

    // Cap score at 100
    return Math.min(100, Math.round(score));
  }

  async assessTransactionRisk(customerId: string, amount: number, transactionType: TransactionType): Promise<{
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    riskScore: number;
    riskFactors: string[];
    recommendations: string[];
  }> {
    const validation = await this.validateTransaction(customerId, amount, transactionType);
    
    const riskFactors: string[] = [];
    
    if (!validation.isValid) {
      riskFactors.push(...validation.errors);
    }
    
    riskFactors.push(...validation.warnings);
    
    // Add additional risk factors based on transaction characteristics
    if (this.isLargeTransaction(amount)) {
      riskFactors.push('Large transaction amount');
    }
    
    if (transactionType === TransactionType.SALE && amount > 10000) {
      riskFactors.push('High-value sale');
    }
    
    // Generate recommendations
    const recommendations: string[] = [];
    
    if (validation.riskLevel === 'HIGH') {
      recommendations.push('Require manager approval');
      recommendations.push('Consider requesting advance payment');
      recommendations.push('Review customer credit file');
    } else if (validation.riskLevel === 'MEDIUM') {
      recommendations.push('Monitor transaction closely');
      recommendations.push('Verify customer contact information');
      recommendations.push('Consider additional verification');
    } else {
      recommendations.push('Standard processing');
    }
    
    return {
      riskLevel: validation.riskLevel,
      riskScore: validation.riskScore,
      riskFactors,
      recommendations
    };
  }

  async validateManagerOverride(customerId: string, amount: number, overrideReason?: string): Promise<{
    allowed: boolean;
    requiresApproval: boolean;
    approvalLevel: 'MANAGER' | 'ADMIN';
    conditions: string[];
  }> {
    const validation = await this.validateTransaction(customerId, amount, TransactionType.SALE);
    
    const conditions: string[] = [];
    
    // Check if override is even possible
    if (!validation.isValid) {
      const error = validation.errors[0];
      if (error?.includes('exceed credit limit')) {
        conditions.push('Limit exceeded - override required');
      } else if (error?.includes('overdue payments')) {
        conditions.push('Overdue payments - override required');
      } else {
        return {
          allowed: false,
          requiresApproval: false,
          approvalLevel: 'MANAGER',
          conditions: ['Cannot override: ' + error]
        };
      }
    }
    
    // Determine approval level based on risk
    let requiresApproval = true;
    let approvalLevel: 'MANAGER' | 'ADMIN' = 'MANAGER';
    
    if (validation.riskScore >= 80) {
      approvalLevel = 'ADMIN';
      conditions.push('High risk score - requires admin approval');
    } else if (validation.riskScore >= 60) {
      approvalLevel = 'MANAGER';
      conditions.push('Moderate risk score - requires manager approval');
    } else {
      requiresApproval = false;
      conditions.push('Low risk - override can be applied');
    }
    
    // Check amount thresholds
    if (amount > 50000) {
      approvalLevel = 'ADMIN';
      conditions.push('Large amount - requires admin approval');
    } else if (amount > 20000) {
      if (approvalLevel !== 'ADMIN') {
        approvalLevel = 'MANAGER';
      }
      conditions.push('Moderate amount - requires manager approval');
    }
    
    // Check if override reason is provided for high-risk overrides
    if ((validation.riskScore >= 70 || amount > 30000) && !overrideReason) {
      conditions.push('Override reason required for high-risk transactions');
    }
    
    return {
      allowed: true,
      requiresApproval,
      approvalLevel,
      conditions
    };
  }

  async validatePayment(customerId: string, paymentAmount: number): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
    suggestedAmount?: number;
  }> {
    const result = {
      isValid: true,
      errors: [] as string[],
      warnings: [] as string[],
      suggestedAmount: undefined as number | undefined
    };

    // 1. Basic validation
    if (paymentAmount <= 0) {
      result.isValid = false;
      result.errors.push('Payment amount must be positive');
      return result;
    }

    // 2. Check customer balance
    const balance = await this.balanceRepository.findByCustomerId(customerId);
    if (!balance) {
      result.isValid = false;
      result.errors.push('Customer balance not found');
      return result;
    }

    // 3. Check if payment exceeds balance
    if (paymentAmount > balance.currentBalance) {
      result.warnings.push(`Payment amount exceeds current balance by ${(paymentAmount - balance.currentBalance).toFixed(2)}`);
      result.suggestedAmount = balance.currentBalance;
    }

    // 4. Check for partial payment opportunity
    if (paymentAmount < balance.currentBalance && balance.currentBalance > 0) {
      result.warnings.push('Partial payment - balance will remain outstanding');
    }

    // 5. Check aging for payment allocation suggestion
    if (balance.ageAnalysis.over180 > 0 && paymentAmount < balance.ageAnalysis.over180) {
      result.warnings.push('Consider allocating payment to oldest balances first');
    }

    return result;
  }

  async validateMultipleTransactions(customerIds: string[], amounts: number[]): Promise<Map<string, CreditLimitValidation>> {
    const results = new Map<string, CreditLimitValidation>();
    
    // Process in parallel for efficiency
    const promises = customerIds.map(async (customerId, index) => {
      try {
        const validation = await this.validateTransaction(customerId, amounts[index], TransactionType.SALE);
        results.set(customerId, validation);
      } catch (error: any) {
        const failedValidation: CreditLimitValidation = {
          isValid: false,
          errors: [`Validation error: ${error.message}`],
          warnings: [],
          riskLevel: 'HIGH',
          riskScore: 100
        };
        results.set(customerId, failedValidation);
      }
    });
    
    await Promise.all(promises);
    
    return results;
  }

  async checkRegulatoryCompliance(customerId: string, transactionAmount: number): Promise<{
    compliant: boolean;
    requirements: string[];
    violations: string[];
  }> {
    const requirements: string[] = [];
    const violations: string[] = [];
    
    // Example regulatory checks (customize for your jurisdiction)
    
    // 1. Large transaction reporting threshold (example: 10,000 MAD)
    if (transactionAmount >= 10000) {
      requirements.push('Large transaction reporting may be required');
    }
    
    // 2. Customer identification verification
    const customer = await this.customerRepository.findById(customerId);
    if (customer) {
      if (!customer.taxId && transactionAmount >= 5000) {
        requirements.push('Tax ID verification recommended');
      }
      
      if (transactionAmount >= 20000 && customer.type === 'INDIVIDUAL') {
        requirements.push('Enhanced due diligence recommended for large individual transactions');
      }
    }
    
    // 3. Credit limit percentage check
    const creditLimit = await this.creditLimitRepository.findActiveByCustomerId(customerId);
    if (creditLimit) {
      const percentageOfLimit = (transactionAmount / creditLimit.amount) * 100;
      if (percentageOfLimit > 50) {
        requirements.push('Transaction exceeds 50% of credit limit - additional review recommended');
      }
    }
    
    // 4. Frequency check (too many large transactions)
    const recentTransactions = await this.transactionRepository.findRecentTransactions(customerId, 30); // Last 30 days
    const largeRecentTransactions = recentTransactions.filter(t => t.amount >= 5000).length;
    
    if (largeRecentTransactions >= 5) {
      requirements.push('Multiple large transactions detected - pattern review recommended');
    }
    
    return {
      compliant: violations.length === 0,
      requirements,
      violations
    };
  }

  private isDebitTransaction(transactionType: TransactionType): boolean {
    return [
      TransactionType.SALE,
      TransactionType.DEBIT_NOTE,
      TransactionType.ADJUSTMENT,
      TransactionType.FEE,
      TransactionType.INTEREST
    ].includes(transactionType);
  }

  private assessAgingRisk(aging: BalanceAgeAnalysis): { riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'; riskScore: number; message: string } {
    if (aging.over180 > 0) {
      return {
        riskLevel: 'HIGH',
        riskScore: 30,
        message: 'Very old outstanding balances (>180 days)'
      };
    }
    
    if (aging.days91_180 > aging.total * 0.1) { // More than 10% in 91-180 days
      return {
        riskLevel: 'HIGH',
        riskScore: 25,
        message: 'Significant balances in 91-180 day range'
      };
    }
    
    if (aging.days61_90 > aging.total * 0.2) { // More than 20% in 61-90 days
      return {
        riskLevel: 'MEDIUM',
        riskScore: 15,
        message: 'Elevated balances in 61-90 day range'
      };
    }
    
    if (aging.days31_60 > aging.total * 0.3) { // More than 30% in 31-60 days
      return {
        riskLevel: 'MEDIUM',
        riskScore: 10,
        message: 'Moderate balances in 31-60 day range'
      };
    }
    
    return {
      riskLevel: 'LOW',
      riskScore: 0,
      message: 'Aging profile within acceptable ranges'
    };
  }

  private async assessTransactionPattern(customerId: string, amount: number, transactionType: TransactionType): Promise<{ riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'; riskScore: number; message: string }> {
    // Get recent transactions (last 30 days)
    const recentTransactions = await this.transactionRepository.findRecentTransactions(customerId, 30);
    
    if (recentTransactions.length === 0) {
      return {
        riskLevel: 'LOW',
        riskScore: 0,
        message: 'No recent transaction history'
      };
    }
    
    // Calculate average transaction amount
    const totalAmount = recentTransactions.reduce((sum, t) => sum + t.amount, 0);
    const averageAmount = totalAmount / recentTransactions.length;
    
    // Check if current transaction is significantly larger than average
    if (amount > averageAmount * 3) {
      return {
        riskLevel: 'MEDIUM',
        riskScore: 15,
        message: 'Transaction significantly larger than average'
      };
    }
    
    // Check transaction frequency
    const transactionsToday = recentTransactions.filter(t => {
      const today = new Date();
      return t.transactionDate.toDateString() === today.toDateString();
    }).length;
    
    if (transactionsToday >= 5) {
      return {
        riskLevel: 'MEDIUM',
        riskScore: 10,
        message: 'High transaction frequency today'
      };
    }
    
    return {
      riskLevel: 'LOW',
      riskScore: 0,
      message: 'Transaction pattern within normal ranges'
    };
  }

  private isLargeTransaction(amount: number, creditLimit?: number): boolean {
    if (creditLimit) {
      return amount > creditLimit * 0.3; // More than 30% of credit limit
    }
    return amount > 10000; // Absolute threshold
  }

  private getHigherRiskLevel(level1: 'LOW' | 'MEDIUM' | 'HIGH', level2: 'LOW' | 'MEDIUM' | 'HIGH'): 'LOW' | 'MEDIUM' | 'HIGH' {
    const riskOrder = { 'LOW': 1, 'MEDIUM': 2, 'HIGH': 3 };
    return riskOrder[level1] >= riskOrder[level2] ? level1 : level2;
  }

  private async calculateAvailableCredit(customerId: string): Promise<number> {
    const creditLimit = await this.creditLimitRepository.findActiveByCustomerId(customerId);
    const balance = await this.balanceRepository.findByCustomerId(customerId);
    
    if (!creditLimit || !balance) {
      return 0;
    }
    
    return Math.max(0, creditLimit.amount - balance.currentBalance);
  }

  private async analyzePaymentHistory(customerId: string): Promise<{ totalPayments: number; onTimePayments: number; latePayments: number; latePaymentRate: number }> {
    const { transactions } = await this.transactionRepository.findByCustomerId(customerId, 1, 1000);
    
    const paymentTransactions = transactions.filter(t => 
      t.type === TransactionType.PAYMENT && t.dueDate
    );
    
    let onTimePayments = 0;
    let latePayments = 0;
    
    paymentTransactions.forEach(t => {
      if (t.transactionDate <= t.dueDate!) {
        onTimePayments++;
      } else {
        latePayments++;
      }
    });
    
    const totalPayments = paymentTransactions.length;
    const latePaymentRate = totalPayments > 0 ? latePayments / totalPayments : 0;
    
    return {
      totalPayments,
      onTimePayments,
      latePayments,
      latePaymentRate
    };
  }
}