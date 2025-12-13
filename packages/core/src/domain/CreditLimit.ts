// packages/core/src/domain/CreditLimit.ts
export interface CreditLimit {
  id: string;
  customerId: string;
  
  // Credit limit details
  amount: number;
  currency: string; // Default: MAD
  validFrom: Date;
  validTo?: Date; // Optional expiration date
  
  // Terms and conditions
  paymentTerms: number; // Days (e.g., 30, 60, 90)
  interestRate?: number; // Annual interest rate for overdue amounts
  gracePeriod: number; // Days before considering overdue
  
  // Status
  status: CreditLimitStatus;
  isActive: boolean;
  
  // Approval workflow
  approvedBy?: string;
  approvedAt?: Date;
  requiresApproval: boolean;
  approvalLevel: 'MANAGER' | 'ADMIN' | 'AUTO';
  
  // History and tracking
  previousLimit?: number;
  limitChangeReason?: string;
  
  // Usage tracking
  currentUtilization: number; // Percentage of limit used
  availableCredit: number; // Limit - current balance
  
  // Metadata
  notes?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  
  // Additional fields for services (ADDED THESE)
  updatedBy?: string;  // ADDED: Used in CreditService.ts line 213, 245, 275, 305, 360
}

export enum CreditLimitStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  SUSPENDED = 'SUSPENDED',
  ACTIVE = 'ACTIVE'
}

// Credit limit change request
export interface CreditLimitChangeRequest {
  id?: string; // ADDED: Optional for compatibility with CreditService.ts line 579
  customerId: string;
  newAmount: number;
  changeReason: string;
  effectiveDate: Date;
  
  // Supporting documents
  supportingDocuments?: string[]; // File IDs or references
  
  // Approval workflow
  requestedBy: string;
  requestedAt: Date;
  approvalRequired: boolean;
  
  // Business justification
  justification: string;
  expectedImpact?: string;
  
  // Status
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewNotes?: string;
}

// Credit limit application input
export interface CreditLimitApplication {
  customerId: string;
  requestedAmount: number;
  currency?: string;
  
  // Financial information
  annualRevenue?: number;
  yearsInBusiness?: number;
  existingCreditReferences?: string[];
  
  // Bank references
  bankName?: string;
  bankAccountNumber?: string;
  bankContact?: string;
  
  // Trade references
  tradeReferences?: Array<{
    companyName: string;
    contactPerson: string;
    phone: string;
    creditAmount: number;
    paymentHistory: string;
  }>;
  
  // Supporting documents
  financialStatements?: string[];
  taxReturns?: string[];
  businessRegistration?: string[];
  
  // Application metadata
  applicationDate: Date;
  appliedBy: string;
  notes?: string;
}

// Credit limit validation result
export interface CreditLimitValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions?: string[];
  
  // Risk assessment
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  riskScore: number; // 0-100
  
  // Recommended limit (if different)
  recommendedLimit?: number;
  recommendationReason?: string;
}

// Credit limit history entry
export interface CreditLimitHistory {
  id: string;
  creditLimitId: string;
  customerId: string;
  
  // Change details
  previousAmount?: number;
  newAmount: number;
  changeType: 'INITIAL' | 'INCREASE' | 'DECREASE' | 'SUSPENSION' | 'REINSTATEMENT' | 'APPROVAL' | 'REJECTION' | 'OVERRIDE'; // ADDED APPROVAL, REJECTION, OVERRIDE
  
  // Change metadata
  changedBy: string;
  changedAt: Date;
  changeReason: string;
  notes?: string;
  
  // Approval info (if applicable)
  approvedBy?: string;
  approvedAt?: Date;
}

// Credit limit utilization report
export interface CreditLimitUtilization {
  customerId: string;
  customerName: string;
  creditLimit: number;
  currentBalance: number;
  availableCredit: number;
  utilizationPercentage: number;
  
  // Risk indicators
  isOverLimit: boolean;
  isNearLimit: boolean; // e.g., >80% utilization
  hasOverduePayments: boolean;
  
  // Trend data
  utilizationTrend: 'INCREASING' | 'DECREASING' | 'STABLE';
  lastChangeDate: Date;
  
  // Alerts
  alerts: string[];
}

// Credit limit settings (system-wide)
export interface CreditLimitSettings {
  defaultCreditLimit: number;
  maximumCreditLimit: number;
  minimumCreditLimit: number;
  
  // Approval thresholds
  autoApproveThreshold: number;
  managerApprovalThreshold: number;
  adminApprovalThreshold: number;
  
  // Risk parameters
  highRiskThreshold: number; // Utilization percentage
  mediumRiskThreshold: number;
  
  // Review settings
  periodicReviewDays: number;
  creditCheckRequired: boolean;
  
  // Notification settings
  notifyOnHighUtilization: boolean;
  highUtilizationThreshold: number; // e.g., 80%
  notifyOnLimitChange: boolean;
}