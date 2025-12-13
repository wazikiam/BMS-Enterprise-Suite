export enum PaymentMethodType {
  CASH = 'cash',
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',
  BANK_TRANSFER = 'bank_transfer',
  CHECK = 'check',
  MOBILE_MONEY = 'mobile_money',
  CREDIT = 'credit',
  CRYPTOCURRENCY = 'cryptocurrency',
  GIFT_CARD = 'gift_card',
  LOYALTY_POINTS = 'loyalty_points',
  OTHER = 'other'
}

export enum PaymentMethodStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  PENDING_APPROVAL = 'pending_approval'
}

export enum FeeType {
  PERCENTAGE = 'percentage',
  FIXED = 'fixed',
  TIERED = 'tiered',
  NONE = 'none'
}

export enum SettlementType {
  INSTANT = 'instant',
  NEXT_DAY = 'next_day',
  WEEKLY = 'weekly',
  BIWEEKLY = 'biweekly',
  MONTHLY = 'monthly',
  MANUAL = 'manual'
}

export interface PaymentMethodFee {
  type: FeeType;
  value: number;
  minimumFee?: number;
  maximumFee?: number;
  tiers?: Array<{
    minAmount: number;
    maxAmount?: number;
    feeValue: number;
  }>;
}

export interface PaymentMethodSettlement {
  type: SettlementType;
  schedule?: string; // Cron expression or day specification
  bankAccountId?: string;
  autoProcess: boolean;
  processingDays?: number; // Days until funds are available
}

export interface PaymentMethodLimits {
  minAmount: number;
  maxAmount: number;
  dailyLimit?: number;
  weeklyLimit?: number;
  monthlyLimit?: number;
  transactionLimit?: number;
}

export interface PaymentMethodValidationRules {
  requireReference: boolean;
  requireBankDetails: boolean;
  requireTransactionId: boolean;
  requireCustomerVerification: boolean;
  allowedCountries?: string[];
  restrictedCountries?: string[];
  allowedCurrencies?: string[];
  requireCVV: boolean;
  requireExpiryDate: boolean;
  requireCardHolderName: boolean;
}

export interface PaymentMethodProps {
  id?: string;
  code: string;
  name: string;
  type: PaymentMethodType;
  description?: string;
  icon?: string;
  status: PaymentMethodStatus;
  isDefault: boolean;
  displayOrder: number;
  requiresOnlineProcessing: boolean;
  processingProvider?: string;
  processingConfig?: Record<string, any>;
  fees: PaymentMethodFee;
  settlement: PaymentMethodSettlement;
  limits: PaymentMethodLimits;
  validationRules: PaymentMethodValidationRules;
  supportedCurrencies: string[];
  supportedCountries: string[];
  metadata?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
  createdById?: string;
  updatedById?: string;
}

export class PaymentMethod {
  public readonly id?: string;
  public readonly code: string;
  public name: string;
  public type: PaymentMethodType;
  public description?: string;
  public icon?: string;
  public status: PaymentMethodStatus;
  public isDefault: boolean;
  public displayOrder: number;
  public requiresOnlineProcessing: boolean;
  public processingProvider?: string;
  public processingConfig?: Record<string, any>;
  public fees: PaymentMethodFee;
  public settlement: PaymentMethodSettlement;
  public limits: PaymentMethodLimits;
  public validationRules: PaymentMethodValidationRules;
  public supportedCurrencies: string[];
  public supportedCountries: string[];
  public metadata?: Record<string, any>;
  public readonly createdAt?: Date;
  public readonly updatedAt?: Date;
  public createdById?: string;
  public updatedById?: string;

  constructor(props: PaymentMethodProps) {
    this.id = props.id;
    this.code = props.code;
    this.name = props.name;
    this.type = props.type;
    this.description = props.description;
    this.icon = props.icon;
    this.status = props.status;
    this.isDefault = props.isDefault;
    this.displayOrder = props.displayOrder;
    this.requiresOnlineProcessing = props.requiresOnlineProcessing;
    this.processingProvider = props.processingProvider;
    this.processingConfig = props.processingConfig;
    this.fees = props.fees;
    this.settlement = props.settlement;
    this.limits = props.limits;
    this.validationRules = props.validationRules;
    this.supportedCurrencies = props.supportedCurrencies;
    this.supportedCountries = props.supportedCountries;
    this.metadata = props.metadata;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.createdById = props.createdById;
    this.updatedById = props.updatedById;

    this.validate();
  }

  private validate(): void {
    if (!this.code.trim()) {
      throw new Error('Payment method code is required');
    }

    if (!this.name.trim()) {
      throw new Error('Payment method name is required');
    }

    if (this.limits.minAmount < 0) {
      throw new Error('Minimum amount cannot be negative');
    }

    if (this.limits.maxAmount <= 0) {
      throw new Error('Maximum amount must be greater than zero');
    }

    if (this.limits.minAmount > this.limits.maxAmount) {
      throw new Error('Minimum amount cannot exceed maximum amount');
    }

    if (this.fees.type === FeeType.PERCENTAGE && (this.fees.value < 0 || this.fees.value > 100)) {
      throw new Error('Percentage fee must be between 0 and 100');
    }

    if (this.fees.type === FeeType.FIXED && this.fees.value < 0) {
      throw new Error('Fixed fee cannot be negative');
    }

    this.validateFees();
    this.validateLimits();
  }

  private validateFees(): void {
    if (this.fees.minimumFee !== undefined && this.fees.minimumFee < 0) {
      throw new Error('Minimum fee cannot be negative');
    }

    if (this.fees.maximumFee !== undefined && this.fees.maximumFee < 0) {
      throw new Error('Maximum fee cannot be negative');
    }

    if (this.fees.minimumFee !== undefined && this.fees.maximumFee !== undefined) {
      if (this.fees.minimumFee > this.fees.maximumFee) {
        throw new Error('Minimum fee cannot exceed maximum fee');
      }
    }

    if (this.fees.tiers) {
      for (let i = 0; i < this.fees.tiers.length; i++) {
        const tier = this.fees.tiers[i];
        
        if (tier.minAmount < 0) {
          throw new Error(`Tier ${i + 1}: Minimum amount cannot be negative`);
        }

        if (tier.feeValue < 0) {
          throw new Error(`Tier ${i + 1}: Fee value cannot be negative`);
        }

        if (tier.maxAmount !== undefined && tier.maxAmount <= tier.minAmount) {
          throw new Error(`Tier ${i + 1}: Maximum amount must be greater than minimum amount`);
        }

        // Check for overlapping tiers
        if (i > 0) {
          const prevTier = this.fees.tiers[i - 1];
          if (prevTier.maxAmount !== undefined && tier.minAmount <= prevTier.maxAmount) {
            throw new Error(`Tier ${i + 1}: Overlapping with previous tier`);
          }
        }
      }
    }
  }

  private validateLimits(): void {
    const limitFields = ['dailyLimit', 'weeklyLimit', 'monthlyLimit', 'transactionLimit'] as const;
    
    for (const field of limitFields) {
      const limit = this.limits[field];
      if (limit !== undefined && limit < 0) {
        throw new Error(`${field} cannot be negative`);
      }
    }
  }

  public calculateFee(amount: number): number {
    if (amount <= 0) {
      return 0;
    }

    let fee = 0;

    switch (this.fees.type) {
      case FeeType.PERCENTAGE:
        fee = amount * (this.fees.value / 100);
        break;

      case FeeType.FIXED:
        fee = this.fees.value;
        break;

      case FeeType.TIERED:
        if (this.fees.tiers) {
          const applicableTier = this.fees.tiers.find(tier => {
            const inMinRange = amount >= tier.minAmount;
            const inMaxRange = tier.maxAmount === undefined || amount <= tier.maxAmount;
            return inMinRange && inMaxRange;
          });

          if (applicableTier) {
            fee = applicableTier.feeValue;
            // If tier fee is percentage
            if (this.fees.value === -1 && applicableTier.feeValue >= 0 && applicableTier.feeValue <= 100) {
              fee = amount * (applicableTier.feeValue / 100);
            }
          }
        }
        break;

      case FeeType.NONE:
        fee = 0;
        break;
    }

    // Apply minimum and maximum fee constraints
    if (this.fees.minimumFee !== undefined && fee < this.fees.minimumFee) {
      fee = this.fees.minimumFee;
    }

    if (this.fees.maximumFee !== undefined && fee > this.fees.maximumFee) {
      fee = this.fees.maximumFee;
    }

    return parseFloat(fee.toFixed(2));
  }

  public calculateNetAmount(amount: number): number {
    const fee = this.calculateFee(amount);
    return parseFloat((amount - fee).toFixed(2));
  }

  public isAmountWithinLimits(amount: number): boolean {
    if (amount < this.limits.minAmount) {
      return false;
    }

    if (amount > this.limits.maxAmount) {
      return false;
    }

    // Check transaction limit if set
    if (this.limits.transactionLimit !== undefined && amount > this.limits.transactionLimit) {
      return false;
    }

    return true;
  }

  public checkLimits(amount: number, usageStats?: {
    dailyTotal?: number;
    weeklyTotal?: number;
    monthlyTotal?: number;
  }): {
    isValid: boolean;
    violations: string[];
  } {
    const violations: string[] = [];

    // Check basic amount limits
    if (amount < this.limits.minAmount) {
      violations.push(`Amount (${amount}) is below minimum (${this.limits.minAmount})`);
    }

    if (amount > this.limits.maxAmount) {
      violations.push(`Amount (${amount}) exceeds maximum (${this.limits.maxAmount})`);
    }

    if (this.limits.transactionLimit !== undefined && amount > this.limits.transactionLimit) {
      violations.push(`Amount (${amount}) exceeds transaction limit (${this.limits.transactionLimit})`);
    }

    // Check periodic limits if usage stats provided
    if (usageStats) {
      if (this.limits.dailyLimit !== undefined && usageStats.dailyTotal !== undefined) {
        const projectedDaily = usageStats.dailyTotal + amount;
        if (projectedDaily > this.limits.dailyLimit) {
          violations.push(`Projected daily total (${projectedDaily}) exceeds daily limit (${this.limits.dailyLimit})`);
        }
      }

      if (this.limits.weeklyLimit !== undefined && usageStats.weeklyTotal !== undefined) {
        const projectedWeekly = usageStats.weeklyTotal + amount;
        if (projectedWeekly > this.limits.weeklyLimit) {
          violations.push(`Projected weekly total (${projectedWeekly}) exceeds weekly limit (${this.limits.weeklyLimit})`);
        }
      }

      if (this.limits.monthlyLimit !== undefined && usageStats.monthlyTotal !== undefined) {
        const projectedMonthly = usageStats.monthlyTotal + amount;
        if (projectedMonthly > this.limits.monthlyLimit) {
          violations.push(`Projected monthly total (${projectedMonthly}) exceeds monthly limit (${this.limits.monthlyLimit})`);
        }
      }
    }

    return {
      isValid: violations.length === 0,
      violations
    };
  }

  public isAvailableForCurrency(currency: string): boolean {
    return this.supportedCurrencies.includes(currency.toUpperCase());
  }

  public isAvailableForCountry(countryCode: string): boolean {
    // Check if country is explicitly allowed
    if (this.supportedCountries.length > 0 && !this.supportedCountries.includes(countryCode.toUpperCase())) {
      return false;
    }

    // Check if country is restricted
    if (this.validationRules.restrictedCountries?.includes(countryCode.toUpperCase())) {
      return false;
    }

    return true;
  }

  public requiresValidation(amount: number): boolean {
    // Example: Require validation for large amounts
    return amount > (this.limits.maxAmount * 0.5); // 50% of max limit
  }

  public getSettlementDate(paymentDate: Date = new Date()): Date {
    const settlementDate = new Date(paymentDate);

    switch (this.settlement.type) {
      case SettlementType.INSTANT:
        // Same day
        break;

      case SettlementType.NEXT_DAY:
        settlementDate.setDate(settlementDate.getDate() + 1);
        // Skip weekends
        while (settlementDate.getDay() === 0 || settlementDate.getDay() === 6) {
          settlementDate.setDate(settlementDate.getDate() + 1);
        }
        break;

      case SettlementType.WEEKLY:
        // Next Friday (example)
        settlementDate.setDate(settlementDate.getDate() + ((5 + 7 - settlementDate.getDay()) % 7));
        break;

      case SettlementType.BIWEEKLY:
        // Every other Friday
        settlementDate.setDate(settlementDate.getDate() + ((5 + 14 - settlementDate.getDay()) % 14));
        break;

      case SettlementType.MONTHLY:
        // 1st of next month
        settlementDate.setMonth(settlementDate.getMonth() + 1, 1);
        break;

      case SettlementType.MANUAL:
        // No automatic settlement date
        settlementDate.setDate(settlementDate.getDate() + (this.settlement.processingDays || 0));
        break;
    }

    return settlementDate;
  }

  public getProcessingInstructions(): string[] {
    const instructions: string[] = [];

    switch (this.type) {
      case PaymentMethodType.CASH:
        instructions.push('Collect cash from customer');
        instructions.push('Provide receipt');
        instructions.push('Deposit to cash drawer');
        break;

      case PaymentMethodType.CREDIT_CARD:
      case PaymentMethodType.DEBIT_CARD:
        instructions.push('Swipe/insert/tap card');
        instructions.push('Verify amount on terminal');
        instructions.push('Have customer enter PIN if required');
        instructions.push('Collect signature for credit cards');
        instructions.push('Provide receipt');
        break;

      case PaymentMethodType.CHECK:
        instructions.push('Verify check details (date, amount, signature)');
        instructions.push('Check ID if required');
        instructions.push('Record check number and bank details');
        instructions.push('Deposit within banking hours');
        break;

      case PaymentMethodType.BANK_TRANSFER:
        instructions.push('Provide bank details to customer');
        instructions.push('Verify transaction reference');
        instructions.push('Confirm receipt in bank statement');
        break;

      case PaymentMethodType.MOBILE_MONEY:
        instructions.push('Initiate payment request');
        instructions.push('Share payment code with customer');
        instructions.push('Confirm receipt on mobile money platform');
        break;

      case PaymentMethodType.CREDIT:
        instructions.push('Verify customer credit limit');
        instructions.push('Record transaction in customer account');
        instructions.push('Update customer balance');
        break;

      case PaymentMethodType.CRYPTOCURRENCY:
        instructions.push('Generate payment address/QR code');
        instructions.push('Share with customer');
        instructions.push('Wait for blockchain confirmation');
        break;

      case PaymentMethodType.GIFT_CARD:
        instructions.push('Check gift card balance');
        instructions.push('Process payment through gift card system');
        instructions.push('Update remaining balance');
        break;

      case PaymentMethodType.LOYALTY_POINTS:
        instructions.push('Verify customer loyalty points balance');
        instructions.push('Calculate points to currency conversion');
        instructions.push('Deduct points from customer account');
        break;
    }

    // Add fee information if applicable
    if (this.fees.type !== FeeType.NONE && this.fees.value > 0) {
      instructions.push(`Fee: ${this.fees.value}${this.fees.type === FeeType.PERCENTAGE ? '%' : ' fixed'}`);
    }

    // Add settlement information
    const settlementDate = this.getSettlementDate();
    instructions.push(`Funds will be available on: ${settlementDate.toLocaleDateString()}`);

    return instructions;
  }

  public activate(): void {
    if (this.status === PaymentMethodStatus.SUSPENDED) {
      throw new Error('Cannot activate a suspended payment method. Contact administrator.');
    }
    this.status = PaymentMethodStatus.ACTIVE;
  }

  public deactivate(): void {
    if (this.isDefault) {
      throw new Error('Cannot deactivate the default payment method');
    }
    this.status = PaymentMethodStatus.INACTIVE;
  }

  public suspend(reason?: string): void {
    this.status = PaymentMethodStatus.SUSPENDED;
    if (reason) {
      this.metadata = {
        ...this.metadata,
        suspensionReason: reason,
        suspendedAt: new Date().toISOString()
      };
    }
  }

  public updateLimits(newLimits: Partial<PaymentMethodLimits>): void {
    const updatedLimits = { ...this.limits, ...newLimits };
    
    // Validate new limits
    const tempMethod = new PaymentMethod({
      ...this.toJSON(),
      limits: updatedLimits
    } as PaymentMethodProps);

    this.limits = updatedLimits;
  }

  public updateFees(newFees: Partial<PaymentMethodFee>): void {
    const updatedFees = { ...this.fees, ...newFees };
    
    // Validate new fees
    const tempMethod = new PaymentMethod({
      ...this.toJSON(),
      fees: updatedFees
    } as PaymentMethodProps);

    this.fees = updatedFees;
  }

  public toJSON() {
    return {
      id: this.id,
      code: this.code,
      name: this.name,
      type: this.type,
      description: this.description,
      icon: this.icon,
      status: this.status,
      isDefault: this.isDefault,
      displayOrder: this.displayOrder,
      requiresOnlineProcessing: this.requiresOnlineProcessing,
      processingProvider: this.processingProvider,
      processingConfig: this.processingConfig,
      fees: this.fees,
      settlement: this.settlement,
      limits: this.limits,
      validationRules: this.validationRules,
      supportedCurrencies: this.supportedCurrencies,
      supportedCountries: this.supportedCountries,
      metadata: this.metadata,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      createdById: this.createdById,
      updatedById: this.updatedById
    };
  }

  // Static factory methods for common payment methods
  public static createCashMethod(): PaymentMethod {
    return new PaymentMethod({
      code: 'CASH',
      name: 'Cash',
      type: PaymentMethodType.CASH,
      description: 'Payment with physical currency',
      icon: '💰',
      status: PaymentMethodStatus.ACTIVE,
      isDefault: true,
      displayOrder: 1,
      requiresOnlineProcessing: false,
      fees: {
        type: FeeType.NONE,
        value: 0
      },
      settlement: {
        type: SettlementType.INSTANT,
        autoProcess: true
      },
      limits: {
        minAmount: 0,
        maxAmount: 10000,
        dailyLimit: 50000,
        weeklyLimit: 200000,
        monthlyLimit: 500000
      },
      validationRules: {
        requireReference: false,
        requireBankDetails: false,
        requireTransactionId: false,
        requireCustomerVerification: false,
        requireCVV: false,
        requireExpiryDate: false,
        requireCardHolderName: false
      },
      supportedCurrencies: ['MAD', 'USD', 'EUR'],
      supportedCountries: ['MA', 'US', 'FR', 'ES']
    });
  }

  public static createCreditCardMethod(): PaymentMethod {
    return new PaymentMethod({
      code: 'CREDIT_CARD',
      name: 'Credit Card',
      type: PaymentMethodType.CREDIT_CARD,
      description: 'Payment with credit card (Visa, MasterCard, etc.)',
      icon: '💳',
      status: PaymentMethodStatus.ACTIVE,
      isDefault: false,
      displayOrder: 2,
      requiresOnlineProcessing: true,
      processingProvider: 'Stripe',
      fees: {
        type: FeeType.PERCENTAGE,
        value: 2.9,
        minimumFee: 0.30
      },
      settlement: {
        type: SettlementType.NEXT_DAY,
        autoProcess: true,
        processingDays: 2
      },
      limits: {
        minAmount: 1,
        maxAmount: 5000,
        transactionLimit: 10000
      },
      validationRules: {
        requireReference: true,
        requireBankDetails: false,
        requireTransactionId: true,
        requireCustomerVerification: true,
        requireCVV: true,
        requireExpiryDate: true,
        requireCardHolderName: true
      },
      supportedCurrencies: ['MAD', 'USD', 'EUR'],
      supportedCountries: ['MA', 'US', 'FR', 'ES', 'GB', 'DE']
    });
  }

  public static createBankTransferMethod(): PaymentMethod {
    return new PaymentMethod({
      code: 'BANK_TRANSFER',
      name: 'Bank Transfer',
      type: PaymentMethodType.BANK_TRANSFER,
      description: 'Direct bank transfer',
      icon: '🏦',
      status: PaymentMethodStatus.ACTIVE,
      isDefault: false,
      displayOrder: 3,
      requiresOnlineProcessing: false,
      fees: {
        type: FeeType.FIXED,
        value: 0,
        minimumFee: 0
      },
      settlement: {
        type: SettlementType.MANUAL,
        autoProcess: false,
        processingDays: 3
      },
      limits: {
        minAmount: 10,
        maxAmount: 50000
      },
      validationRules: {
        requireReference: true,
        requireBankDetails: true,
        requireTransactionId: true,
        requireCustomerVerification: true,
        requireCVV: false,
        requireExpiryDate: false,
        requireCardHolderName: false
      },
      supportedCurrencies: ['MAD'],
      supportedCountries: ['MA']
    });
  }

  public static createCreditMethod(): PaymentMethod {
    return new PaymentMethod({
      code: 'CREDIT',
      name: 'Customer Credit',
      type: PaymentMethodType.CREDIT,
      description: 'Pay using customer credit account',
      icon: '📝',
      status: PaymentMethodStatus.ACTIVE,
      isDefault: false,
      displayOrder: 4,
      requiresOnlineProcessing: false,
      fees: {
        type: FeeType.NONE,
        value: 0
      },
      settlement: {
        type: SettlementType.INSTANT,
        autoProcess: true
      },
      limits: {
        minAmount: 0,
        maxAmount: 100000
      },
      validationRules: {
        requireReference: false,
        requireBankDetails: false,
        requireTransactionId: false,
        requireCustomerVerification: true,
        requireCVV: false,
        requireExpiryDate: false,
        requireCardHolderName: false
      },
      supportedCurrencies: ['MAD'],
      supportedCountries: ['MA']
    });
  }
} 
