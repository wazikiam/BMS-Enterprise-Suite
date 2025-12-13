// packages/core/src/domain/CustomerBalance.ts

/* ======================================================
   CORE CUSTOMER BALANCE DOMAIN
   ====================================================== */

/**
 * Represents the current financial state of a customer.
 * Positive balance = customer owes money.
 */
export interface CustomerBalance {
  id: string;
  customerId: string;

  currency: string; // Default: MAD

  // Core balances
  currentBalance: number;
  creditLimit: number;
  availableBalance: number;

  // Aging
  overdueAmount: number;
  currentAmount: number;
  futureAmount: number;
  ageAnalysis: BalanceAgeAnalysis;

  // Status flags
  isOverdue: boolean;
  isOverLimit: boolean;

  // Payment stats
  totalDebit: number;   // Sales, fees
  totalCredit: number;  // Payments, refunds
  averageDaysToPay: number;
  lastPaymentDate?: Date;
  lastPaymentAmount?: number;

  // Metadata
  lastUpdated: Date;
  updatedBy: string;
  version: number;
}

/* ======================================================
   AGING ANALYSIS
   ====================================================== */

export interface BalanceAgeAnalysis {
  current: number;      // 0–30 days
  days31_60: number;
  days61_90: number;
  days91_180: number;
  over180: number;
  total: number;
}

/* ======================================================
   BALANCE TRANSACTIONS (LEDGER)
   ====================================================== */

export enum BalanceTransactionType {
  DEBIT = 'DEBIT',   // Increases balance (sale)
  CREDIT = 'CREDIT'  // Decreases balance (payment/refund)
}

export interface BalanceTransaction {
  id: string;
  customerId: string;
  balanceId: string;

  type: BalanceTransactionType;
  amount: number;
  currency: string;

  referenceType:
    | 'SALE'
    | 'PAYMENT'
    | 'REFUND'
    | 'ADJUSTMENT'
    | 'REVERSAL'
    | 'TRANSFER';

  referenceId: string;
  referenceNumber: string;

  transactionDate: Date;
  dueDate?: Date;
  postingDate: Date;

  status: 'PENDING' | 'POSTED' | 'VOIDED' | 'REVERSED';
  isReconciled: boolean;

  description: string;
  notes?: string;

  // Audit
  createdBy: string;
  createdAt: Date;
  version: number;

  // Ledger integrity
  balanceBefore: number;
  balanceAfter: number;
}

/* ======================================================
   ADJUSTMENTS
   ====================================================== */

export interface BalanceAdjustment {
  id: string;
  customerId: string;

  adjustmentType: 'WRITE_OFF' | 'WRITE_BACK' | 'CORRECTION' | 'DISCOUNT';
  amount: number;
  currency: string;

  reason: string;
  justification: string;

  approvedBy?: string;
  approvedAt?: Date;

  originalTransactionId?: string;

  adjustedBy: string;
  adjustedAt: Date;
  notes?: string;
}

/* ======================================================
   SNAPSHOTS (REPORTING)
   ====================================================== */

export interface BalanceSnapshot {
  id: string;
  customerId: string;
  snapshotDate: Date;

  balance: number;
  creditLimit: number;
  availableCredit: number;

  ageAnalysis: BalanceAgeAnalysis;

  isOverdue: boolean;
  isOverLimit: boolean;

  createdBy: string;
  createdAt: Date;
}

/* ======================================================
   RECONCILIATION
   ====================================================== */

export interface BalanceReconciliation {
  id: string;
  customerId: string;

  reconciliationDate: Date;

  startingBalance: number;
  endingBalance: number;
  calculatedBalance: number;
  difference: number;

  transactionCount: number;
  transactionTotal: number;

  status: 'IN_PROGRESS' | 'COMPLETED' | 'DISCREPANCY';

  discrepancies?: ReconciliationDiscrepancy[];

  reconciledBy: string;
  reconciledAt: Date;
  notes?: string;
}

export interface ReconciliationDiscrepancy {
  id?: string;
  reconciliationId?: string;

  transactionId?: string;
  transactionType: string;

  expectedAmount: number;
  actualAmount: number;
  difference: number;

  description: string;
  resolved: boolean;
  resolvedById?: string;
  resolvedAt?: Date;
}

/* ======================================================
   ALERTS
   ====================================================== */

export enum BalanceAlertType {
  OVERDUE_BALANCE = 'OVERDUE_BALANCE',
  HIGH_UTILIZATION = 'HIGH_UTILIZATION',
  CREDIT_LIMIT_EXCEEDED = 'CREDIT_LIMIT_EXCEEDED',
  LARGE_TRANSACTION = 'LARGE_TRANSACTION',
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED'
}

export interface BalanceAlertConfig {
  customerId?: string;

  alertTypes: BalanceAlertType[];

  thresholds: {
    balanceThreshold: number;
    utilizationThreshold: number;
    overdueDays: number;
    creditLimitUsagePercent: number;
  };

  notificationChannels: Array<'EMAIL' | 'SMS' | 'DASHBOARD'>;
  isActive: boolean;
}
