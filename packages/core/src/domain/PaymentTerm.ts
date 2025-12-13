export enum PaymentTermType {
  IMMEDIATE = 'immediate',
  NET = 'net',
  END_OF_MONTH = 'end_of_month',
  FIXED_DATE = 'fixed_date',
  INSTALLMENT = 'installment',
  DEFERRED = 'deferred',
  CUSTOM = 'custom'
}

export enum DiscountType {
  PERCENTAGE = 'percentage',
  FIXED = 'fixed',
  NONE = 'none'
}

export interface InstallmentSchedule {
  numberOfPayments: number;
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
  firstPaymentDueDays: number;
  equalPayments: boolean;
  percentages?: number[]; // For unequal payments
}

export interface EarlyPaymentDiscount {
  type: DiscountType;
  value: number;
  daysBeforeDue: number;
  applyTo: 'total' | 'subtotal' | 'tax' | 'specific_items';
}

export interface LatePaymentPenalty {
  type: 'percentage' | 'fixed' | 'daily_percentage';
  value: number;
  gracePeriodDays: number;
  maximumPenalty?: number;
  appliesAfterGracePeriod: boolean;
}

export interface PaymentTermProps {
  id?: string;
  code: string;
  name: string;
  description?: string;
  type: PaymentTermType;
  netDays?: number; // For NET terms: payment due in X days
  dueDayOfMonth?: number; // For END_OF_MONTH: due on specific day (1-31)
  fixedDueDate?: Date; // For FIXED_DATE terms
  installmentSchedule?: InstallmentSchedule; // For INSTALLMENT terms
  deferredMonths?: number; // For DEFERRED terms
  earlyPaymentDiscount?: EarlyPaymentDiscount;
  latePaymentPenalty?: LatePaymentPenalty;
  isDefault: boolean;
  isActive: boolean;
  appliesTo: 'sales' | 'purchases' | 'both';
  minimumAmount?: number;
  maximumAmount?: number;
  currency?: string;
  metadata?: Record<string, any>;
  createdById?: string;
  updatedById?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export class PaymentTerm {
  public readonly id?: string;
  public readonly code: string;
  public name: string;
  public description?: string;
  public type: PaymentTermType;
  public netDays?: number;
  public dueDayOfMonth?: number;
  public fixedDueDate?: Date;
  public installmentSchedule?: InstallmentSchedule;
  public deferredMonths?: number;
  public earlyPaymentDiscount?: EarlyPaymentDiscount;
  public latePaymentPenalty?: LatePaymentPenalty;
  public isDefault: boolean;
  public isActive: boolean;
  public appliesTo: 'sales' | 'purchases' | 'both';
  public minimumAmount?: number;
  public maximumAmount?: number;
  public currency?: string;
  public metadata?: Record<string, any>;
  public readonly createdById?: string;
  public readonly updatedById?: string;
  public readonly createdAt?: Date;
  public readonly updatedAt?: Date;

  constructor(props: PaymentTermProps) {
    this.id = props.id;
    this.code = props.code;
    this.name = props.name;
    this.description = props.description;
    this.type = props.type;
    this.netDays = props.netDays;
    this.dueDayOfMonth = props.dueDayOfMonth;
    this.fixedDueDate = props.fixedDueDate;
    this.installmentSchedule = props.installmentSchedule;
    this.deferredMonths = props.deferredMonths;
    this.earlyPaymentDiscount = props.earlyPaymentDiscount;
    this.latePaymentPenalty = props.latePaymentPenalty;
    this.isDefault = props.isDefault;
    this.isActive = props.isActive;
    this.appliesTo = props.appliesTo;
    this.minimumAmount = props.minimumAmount;
    this.maximumAmount = props.maximumAmount;
    this.currency = props.currency;
    this.metadata = props.metadata;
    this.createdById = props.createdById;
    this.updatedById = props.updatedById;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;

    this.validate();
  }

  private validate(): void {
    if (!this.code.trim()) {
      throw new Error('Payment term code is required');
    }

    if (!this.name.trim()) {
      throw new Error('Payment term name is required');
    }

    // Validate based on type
    switch (this.type) {
      case PaymentTermType.NET:
        if (!this.netDays || this.netDays <= 0) {
          throw new Error('NET terms require positive netDays');
        }
        break;

      case PaymentTermType.END_OF_MONTH:
        if (!this.dueDayOfMonth || this.dueDayOfMonth < 1 || this.dueDayOfMonth > 31) {
          throw new Error('END_OF_MONTH terms require dueDayOfMonth between 1 and 31');
        }
        break;

      case PaymentTermType.FIXED_DATE:
        if (!this.fixedDueDate) {
          throw new Error('FIXED_DATE terms require a fixedDueDate');
        }
        break;

      case PaymentTermType.INSTALLMENT:
        if (!this.installmentSchedule) {
          throw new Error('INSTALLMENT terms require an installmentSchedule');
        }
        this.validateInstallmentSchedule();
        break;

      case PaymentTermType.DEFERRED:
        if (!this.deferredMonths || this.deferredMonths <= 0) {
          throw new Error('DEFERRED terms require positive deferredMonths');
        }
        break;
    }

    // Validate early payment discount if present
    if (this.earlyPaymentDiscount) {
      this.validateEarlyPaymentDiscount();
    }

    // Validate late payment penalty if present
    if (this.latePaymentPenalty) {
      this.validateLatePaymentPenalty();
    }

    // Validate amount limits
    if (this.minimumAmount !== undefined && this.minimumAmount < 0) {
      throw new Error('Minimum amount cannot be negative');
    }

    if (this.maximumAmount !== undefined && this.maximumAmount < 0) {
      throw new Error('Maximum amount cannot be negative');
    }

    if (this.minimumAmount !== undefined && this.maximumAmount !== undefined) {
      if (this.minimumAmount > this.maximumAmount) {
        throw new Error('Minimum amount cannot exceed maximum amount');
      }
    }
  }

  private validateInstallmentSchedule(): void {
    if (!this.installmentSchedule) return;

    const { numberOfPayments, frequency, firstPaymentDueDays, equalPayments, percentages } = this.installmentSchedule;

    if (numberOfPayments <= 0) {
      throw new Error('Installment schedule must have at least 1 payment');
    }

    if (firstPaymentDueDays < 0) {
      throw new Error('First payment due days cannot be negative');
    }

    if (!equalPayments && percentages) {
      if (percentages.length !== numberOfPayments) {
        throw new Error('Percentages array length must match number of payments');
      }

      const totalPercentage = percentages.reduce((sum, p) => sum + p, 0);
      if (Math.abs(totalPercentage - 100) > 0.01) {
        throw new Error(`Percentages must sum to 100% (current: ${totalPercentage}%)`);
      }

      for (let i = 0; i < percentages.length; i++) {
        if (percentages[i] <= 0) {
          throw new Error(`Payment ${i + 1}: Percentage must be positive`);
        }
      }
    }
  }

  private validateEarlyPaymentDiscount(): void {
    if (!this.earlyPaymentDiscount) return;

    const { type, value, daysBeforeDue } = this.earlyPaymentDiscount;

    if (daysBeforeDue <= 0) {
      throw new Error('Early payment discount daysBeforeDue must be positive');
    }

    if (type !== DiscountType.NONE) {
      if (value <= 0) {
        throw new Error('Early payment discount value must be positive');
      }

      if (type === DiscountType.PERCENTAGE && value > 100) {
        throw new Error('Early payment discount percentage cannot exceed 100%');
      }
    }
  }

  private validateLatePaymentPenalty(): void {
    if (!this.latePaymentPenalty) return;

    const { type, value, gracePeriodDays, maximumPenalty } = this.latePaymentPenalty;

    if (gracePeriodDays < 0) {
      throw new Error('Late payment penalty grace period cannot be negative');
    }

    if (value <= 0) {
      throw new Error('Late payment penalty value must be positive');
    }

    if (type === 'percentage' && value > 100) {
      throw new Error('Late payment penalty percentage cannot exceed 100%');
    }

    if (maximumPenalty !== undefined && maximumPenalty < 0) {
      throw new Error('Late payment penalty maximum cannot be negative');
    }
  }

  /**
   * Calculate due date based on invoice/order date
   */
  public calculateDueDate(invoiceDate: Date = new Date()): Date {
    const dueDate = new Date(invoiceDate);

    switch (this.type) {
      case PaymentTermType.IMMEDIATE:
        // Due immediately (same day)
        break;

      case PaymentTermType.NET:
        if (this.netDays) {
          dueDate.setDate(dueDate.getDate() + this.netDays);
        }
        break;

      case PaymentTermType.END_OF_MONTH:
        if (this.dueDayOfMonth) {
          // Set to the due day of the current month
          dueDate.setDate(this.dueDayOfMonth);
          
          // If the due day has already passed this month, move to next month
          if (dueDate < invoiceDate) {
            dueDate.setMonth(dueDate.getMonth() + 1);
          }
        }
        break;

      case PaymentTermType.FIXED_DATE:
        if (this.fixedDueDate) {
          return new Date(this.fixedDueDate);
        }
        break;

      case PaymentTermType.DEFERRED:
        if (this.deferredMonths) {
          dueDate.setMonth(dueDate.getMonth() + this.deferredMonths);
        }
        break;

      case PaymentTermType.INSTALLMENT:
        if (this.installmentSchedule) {
          dueDate.setDate(dueDate.getDate() + this.installmentSchedule.firstPaymentDueDays);
        }
        break;

      case PaymentTermType.CUSTOM:
        // Custom logic would be implemented based on metadata
        // For now, default to NET 30
        dueDate.setDate(dueDate.getDate() + 30);
        break;
    }

    // Adjust for weekends/holidays (simple version - move to next business day)
    while (dueDate.getDay() === 0 || dueDate.getDay() === 6) {
      dueDate.setDate(dueDate.getDate() + 1);
    }

    return dueDate;
  }

  /**
   * Calculate installment due dates
   */
  public calculateInstallmentDueDates(
    invoiceDate: Date = new Date(),
    totalAmount: number
  ): Array<{ dueDate: Date; amount: number; installmentNumber: number }> {
    if (this.type !== PaymentTermType.INSTALLMENT || !this.installmentSchedule) {
      return [{
        dueDate: this.calculateDueDate(invoiceDate),
        amount: totalAmount,
        installmentNumber: 1
      }];
    }

    const { numberOfPayments, frequency, firstPaymentDueDays, equalPayments, percentages } = this.installmentSchedule;
    const installments: Array<{ dueDate: Date; amount: number; installmentNumber: number }> = [];

    // Calculate due dates
    for (let i = 0; i < numberOfPayments; i++) {
      const dueDate = new Date(invoiceDate);
      
      // First payment
      if (i === 0) {
        dueDate.setDate(dueDate.getDate() + firstPaymentDueDays);
      } else {
        // Subsequent payments based on frequency
        const previousDueDate = new Date(installments[i - 1].dueDate);
        
        switch (frequency) {
          case 'daily':
            previousDueDate.setDate(previousDueDate.getDate() + 1);
            break;
          case 'weekly':
            previousDueDate.setDate(previousDueDate.getDate() + 7);
            break;
          case 'biweekly':
            previousDueDate.setDate(previousDueDate.getDate() + 14);
            break;
          case 'monthly':
            previousDueDate.setMonth(previousDueDate.getMonth() + 1);
            break;
          case 'quarterly':
            previousDueDate.setMonth(previousDueDate.getMonth() + 3);
            break;
          case 'yearly':
            previousDueDate.setFullYear(previousDueDate.getFullYear() + 1);
            break;
        }
        
        dueDate.setTime(previousDueDate.getTime());
      }

      // Adjust for weekends
      while (dueDate.getDay() === 0 || dueDate.getDay() === 6) {
        dueDate.setDate(dueDate.getDate() + 1);
      }

      // Calculate amount
      let amount: number;
      if (equalPayments) {
        amount = parseFloat((totalAmount / numberOfPayments).toFixed(2));
      } else if (percentages) {
        amount = parseFloat((totalAmount * (percentages[i] / 100)).toFixed(2));
      } else {
        amount = parseFloat((totalAmount / numberOfPayments).toFixed(2));
      }

      installments.push({
        dueDate,
        amount,
        installmentNumber: i + 1
      });
    }

    // Adjust last installment to account for rounding errors
    if (installments.length > 0) {
      const calculatedTotal = installments.reduce((sum, inst) => sum + inst.amount, 0);
      const difference = parseFloat((totalAmount - calculatedTotal).toFixed(2));
      
      if (Math.abs(difference) > 0.01) {
        installments[installments.length - 1].amount = 
          parseFloat((installments[installments.length - 1].amount + difference).toFixed(2));
      }
    }

    return installments;
  }

  /**
   * Calculate early payment discount amount
   */
  public calculateEarlyPaymentDiscount(
    totalAmount: number,
    paymentDate: Date,
    dueDate: Date
  ): { discountAmount: number; netAmount: number; isValid: boolean } {
    if (!this.earlyPaymentDiscount || this.earlyPaymentDiscount.type === DiscountType.NONE) {
      return { discountAmount: 0, netAmount: totalAmount, isValid: true };
    }

    const { type, value, daysBeforeDue } = this.earlyPaymentDiscount;

    // Check if payment is early enough
    const daysDifference = Math.ceil((dueDate.getTime() - paymentDate.getTime()) / (1000 * 60 * 60 * 24));
    const isEarlyEnough = daysDifference >= daysBeforeDue;

    if (!isEarlyEnough) {
      return { discountAmount: 0, netAmount: totalAmount, isValid: false };
    }

    let discountAmount = 0;

    switch (type) {
      case DiscountType.PERCENTAGE:
        discountAmount = totalAmount * (value / 100);
        break;

      case DiscountType.FIXED:
        discountAmount = Math.min(value, totalAmount);
        break;

      // Note: DiscountType.NONE is already handled at the beginning of the method
      // so we don't need a case for it here
    }

    const netAmount = parseFloat((totalAmount - discountAmount).toFixed(2));
    discountAmount = parseFloat(discountAmount.toFixed(2));

    return { discountAmount, netAmount, isValid: true };
  }

  /**
   * Calculate late payment penalty amount
   */
  public calculateLatePaymentPenalty(
    totalAmount: number,
    paymentDate: Date,
    dueDate: Date
  ): { penaltyAmount: number; daysLate: number; isPenaltyApplicable: boolean } {
    if (!this.latePaymentPenalty) {
      return { penaltyAmount: 0, daysLate: 0, isPenaltyApplicable: false };
    }

    const { type, value, gracePeriodDays, maximumPenalty, appliesAfterGracePeriod } = this.latePaymentPenalty;

    // Check if payment is late
    const daysLate = Math.max(0, Math.ceil((paymentDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));

    if (daysLate <= 0) {
      return { penaltyAmount: 0, daysLate: 0, isPenaltyApplicable: false };
    }

    // Check grace period
    if (gracePeriodDays > 0 && daysLate <= gracePeriodDays && !appliesAfterGracePeriod) {
      return { penaltyAmount: 0, daysLate, isPenaltyApplicable: false };
    }

    let penaltyAmount = 0;
    const effectiveDaysLate = Math.max(0, daysLate - gracePeriodDays);

    switch (type) {
      case 'percentage':
        penaltyAmount = totalAmount * (value / 100);
        break;

      case 'fixed':
        penaltyAmount = value;
        break;

      case 'daily_percentage':
        penaltyAmount = totalAmount * (value / 100) * effectiveDaysLate;
        break;
    }

    // Apply maximum penalty if specified
    if (maximumPenalty !== undefined && penaltyAmount > maximumPenalty) {
      penaltyAmount = maximumPenalty;
    }

    penaltyAmount = parseFloat(penaltyAmount.toFixed(2));

    return { penaltyAmount, daysLate, isPenaltyApplicable: penaltyAmount > 0 };
  }

  /**
   * Check if amount is within term limits
   */
  public isAmountWithinLimits(amount: number): boolean {
    if (this.minimumAmount !== undefined && amount < this.minimumAmount) {
      return false;
    }

    if (this.maximumAmount !== undefined && amount > this.maximumAmount) {
      return false;
    }

    return true;
  }

  /**
   * Check if term applies to transaction type
   */
  public appliesToTransaction(transactionType: 'sale' | 'purchase'): boolean {
    if (this.appliesTo === 'both') return true;
    if (this.appliesTo === 'sales' && transactionType === 'sale') return true;
    if (this.appliesTo === 'purchases' && transactionType === 'purchase') return true;
    return false;
  }

  /**
   * Get description with details
   */
  public getDetailedDescription(): string {
    let description = `${this.name} (${this.code}) - `;

    switch (this.type) {
      case PaymentTermType.IMMEDIATE:
        description += 'Payment due immediately';
        break;

      case PaymentTermType.NET:
        description += `Net ${this.netDays} days`;
        break;

      case PaymentTermType.END_OF_MONTH:
        description += `Due on the ${this.dueDayOfMonth}${this.getOrdinalSuffix(this.dueDayOfMonth || 0)} of the month`;
        break;

      case PaymentTermType.FIXED_DATE:
        if (this.fixedDueDate) {
          description += `Due on ${this.fixedDueDate.toLocaleDateString()}`;
        }
        break;

      case PaymentTermType.INSTALLMENT:
        if (this.installmentSchedule) {
          const { numberOfPayments, frequency } = this.installmentSchedule;
          description += `${numberOfPayments} ${frequency} installments`;
        }
        break;

      case PaymentTermType.DEFERRED:
        description += `Deferred ${this.deferredMonths} months`;
        break;

      case PaymentTermType.CUSTOM:
        description += 'Custom payment terms';
        break;
    }

    // Add discount info if available
    if (this.earlyPaymentDiscount && this.earlyPaymentDiscount.type !== DiscountType.NONE) {
      const { type, value, daysBeforeDue } = this.earlyPaymentDiscount;
      const discountStr = type === DiscountType.PERCENTAGE ? `${value}%` : `${value} fixed`;
      description += `, ${discountStr} discount if paid ${daysBeforeDue} days early`;
    }

    // Add penalty info if available
    if (this.latePaymentPenalty) {
      const { type, value, gracePeriodDays } = this.latePaymentPenalty;
      const penaltyStr = type === 'percentage' ? `${value}%` : 
                        type === 'daily_percentage' ? `${value}% daily` : 
                        `${value} fixed`;
      description += `, ${penaltyStr} penalty after ${gracePeriodDays} days grace`;
    }

    return description;
  }

  /**
   * Activate the payment term
   */
  public activate(): void {
    this.isActive = true;
  }

  /**
   * Deactivate the payment term
   */
  public deactivate(): void {
    if (this.isDefault) {
      throw new Error('Cannot deactivate the default payment term');
    }
    this.isActive = false;
  }

  /**
   * Set as default payment term
   */
  public setAsDefault(): void {
    this.isDefault = true;
    this.isActive = true;
  }

  /**
   * Update installment schedule
   */
  public updateInstallmentSchedule(schedule: InstallmentSchedule): void {
    const oldSchedule = this.installmentSchedule;
    this.installmentSchedule = schedule;
    
    try {
      this.validateInstallmentSchedule();
    } catch (error) {
      this.installmentSchedule = oldSchedule;
      throw error;
    }
  }

  /**
   * Update early payment discount
   */
  public updateEarlyPaymentDiscount(discount: EarlyPaymentDiscount): void {
    const oldDiscount = this.earlyPaymentDiscount;
    this.earlyPaymentDiscount = discount;
    
    try {
      this.validateEarlyPaymentDiscount();
    } catch (error) {
      this.earlyPaymentDiscount = oldDiscount;
      throw error;
    }
  }

  /**
   * Update late payment penalty
   */
  public updateLatePaymentPenalty(penalty: LatePaymentPenalty): void {
    const oldPenalty = this.latePaymentPenalty;
    this.latePaymentPenalty = penalty;
    
    try {
      this.validateLatePaymentPenalty();
    } catch (error) {
      this.latePaymentPenalty = oldPenalty;
      throw error;
    }
  }

  private getOrdinalSuffix(n: number): string {
    const j = n % 10;
    const k = n % 100;
    
    if (j === 1 && k !== 11) return 'st';
    if (j === 2 && k !== 12) return 'nd';
    if (j === 3 && k !== 13) return 'rd';
    return 'th';
  }

  public toJSON() {
    return {
      id: this.id,
      code: this.code,
      name: this.name,
      description: this.description,
      type: this.type,
      netDays: this.netDays,
      dueDayOfMonth: this.dueDayOfMonth,
      fixedDueDate: this.fixedDueDate,
      installmentSchedule: this.installmentSchedule,
      deferredMonths: this.deferredMonths,
      earlyPaymentDiscount: this.earlyPaymentDiscount,
      latePaymentPenalty: this.latePaymentPenalty,
      isDefault: this.isDefault,
      isActive: this.isActive,
      appliesTo: this.appliesTo,
      minimumAmount: this.minimumAmount,
      maximumAmount: this.maximumAmount,
      currency: this.currency,
      metadata: this.metadata,
      createdById: this.createdById,
      updatedById: this.updatedById,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      detailedDescription: this.getDetailedDescription()
    };
  }

  // Static factory methods for common payment terms
  public static createImmediatePayment(): PaymentTerm {
    return new PaymentTerm({
      code: 'IMMEDIATE',
      name: 'Immediate Payment',
      description: 'Payment due immediately upon invoice',
      type: PaymentTermType.IMMEDIATE,
      isDefault: true,
      isActive: true,
      appliesTo: 'both'
    });
  }

  public static createNet30(): PaymentTerm {
    return new PaymentTerm({
      code: 'NET30',
      name: 'Net 30 Days',
      description: 'Payment due 30 days from invoice date',
      type: PaymentTermType.NET,
      netDays: 30,
      isDefault: false,
      isActive: true,
      appliesTo: 'both'
    });
  }

  public static createNet30WithDiscount(): PaymentTerm {
    return new PaymentTerm({
      code: '2/10NET30',
      name: '2/10 Net 30',
      description: '2% discount if paid within 10 days, otherwise net 30',
      type: PaymentTermType.NET,
      netDays: 30,
      earlyPaymentDiscount: {
        type: DiscountType.PERCENTAGE,
        value: 2,
        daysBeforeDue: 20, // 30 - 10 = 20 days before due to get discount
        applyTo: 'total'
      },
      isDefault: false,
      isActive: true,
      appliesTo: 'sales'
    });
  }

  public static createEndOfMonth(): PaymentTerm {
    return new PaymentTerm({
      code: 'EOM',
      name: 'End of Month',
      description: 'Payment due on the 15th of the following month',
      type: PaymentTermType.END_OF_MONTH,
      dueDayOfMonth: 15,
      isDefault: false,
      isActive: true,
      appliesTo: 'both'
    });
  }

  public static createInstallment3Months(): PaymentTerm {
    return new PaymentTerm({
      code: 'INSTALL3',
      name: '3 Monthly Installments',
      description: 'Payment in 3 equal monthly installments',
      type: PaymentTermType.INSTALLMENT,
      installmentSchedule: {
        numberOfPayments: 3,
        frequency: 'monthly',
        firstPaymentDueDays: 0,
        equalPayments: true
      },
      isDefault: false,
      isActive: true,
      appliesTo: 'sales',
      minimumAmount: 1000
    });
  }

  public static createDeferred90Days(): PaymentTerm {
    return new PaymentTerm({
      code: 'DEFERRED90',
      name: 'Deferred 90 Days',
      description: 'Payment deferred for 90 days',
      type: PaymentTermType.DEFERRED,
      deferredMonths: 3,
      isDefault: false,
      isActive: true,
      appliesTo: 'sales',
      minimumAmount: 5000,
      maximumAmount: 50000
    });
  }
}