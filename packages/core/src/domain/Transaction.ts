// packages/core/src/domain/Transaction.ts
export enum TransactionType {
  SALE = 'SALE',
  PAYMENT = 'PAYMENT',
  CREDIT_NOTE = 'CREDIT_NOTE',
  DEBIT_NOTE = 'DEBIT_NOTE',
  ADJUSTMENT = 'ADJUSTMENT',
  REFUND = 'REFUND',
  WRITE_OFF = 'WRITE_OFF',
  TRANSFER = 'TRANSFER',
  FEE = 'FEE',
  INTEREST = 'INTEREST'
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  POSTED = 'POSTED',
  VOIDED = 'VOIDED',
  REVERSED = 'REVERSED',
  CANCELLED = 'CANCELLED',
  DISPUTED = 'DISPUTED'
}

export enum PaymentMethod {
  CASH = 'CASH',
  CHECK = 'CHECK',
  BANK_TRANSFER = 'BANK_TRANSFER',
  CREDIT_CARD = 'CREDIT_CARD',
  DEBIT_CARD = 'DEBIT_CARD',
  MOBILE_PAYMENT = 'MOBILE_PAYMENT',
  CREDIT = 'CREDIT', // On account
  OTHER = 'OTHER'
}

export interface Transaction {
  id: string;
  transactionNumber: string;
  customerId: string;
  
  // Core transaction data
  type: TransactionType;
  status: TransactionStatus;
  amount: number;
  currency: string;
  
  // Dates
  transactionDate: Date;
  postingDate: Date;
  dueDate?: Date;
  
  // Payment information (for payment transactions)
  paymentMethod?: PaymentMethod;
  paymentReference?: string;
  bankAccount?: string;
  checkNumber?: string;
  
  // References
  referenceType?: 'SALE_ORDER' | 'INVOICE' | 'CREDIT_NOTE' | 'PURCHASE' | 'MANUAL';
  referenceId?: string;
  referenceNumber?: string;
  
  // Balance impact
  balanceBefore: number;
  balanceAfter: number;
  creditLimitBefore?: number;
  creditLimitAfter?: number;
  
  // Description and notes
  description: string;
  notes?: string;
  internalNotes?: string; // For staff only
  
  // Financial accounting
  glAccount?: string;
  taxAmount?: number;
  netAmount: number;
  
  // Approval workflow
  requiresApproval: boolean;
  approvedBy?: string;
  approvedAt?: Date;
  approvalNotes?: string;
  
  // Reversal information
  isReversal: boolean;
  reversedTransactionId?: string;
  reversalReason?: string;
  
  // Attachments
  attachmentIds: string[];
  
  // Metadata
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  updatedBy: string;
  
  // Version for optimistic locking
  version: number;
}

// Transaction creation input
export interface TransactionCreateInput {
  customerId: string;
  type: TransactionType;
  amount: number;
  currency?: string;
  transactionDate: Date;
  dueDate?: Date;
  
  // Payment details (if applicable)
  paymentMethod?: PaymentMethod;
  paymentReference?: string;
  bankAccount?: string;
  checkNumber?: string;
  
  // References
  referenceType?: 'SALE_ORDER' | 'INVOICE' | 'CREDIT_NOTE' | 'PURCHASE' | 'MANUAL';
  referenceId?: string;
  referenceNumber?: string;
  
  // Description
  description: string;
  notes?: string;
  
  // Financial
  taxAmount?: number;
  glAccount?: string;
  
  // Attachments
  attachmentIds?: string[];
}

// Transaction update input (limited fields)
export interface TransactionUpdateInput {
  status?: TransactionStatus;
  notes?: string;
  internalNotes?: string;
  dueDate?: Date;
  paymentMethod?: PaymentMethod;
  paymentReference?: string;
}

// Transaction search filters
export interface TransactionFilters {
  customerId?: string;
  type?: TransactionType;
  status?: TransactionStatus;
  paymentMethod?: PaymentMethod;
  
  // Date ranges
  fromDate?: Date;
  toDate?: Date;
  fromDueDate?: Date;
  toDueDate?: Date;
  
  // Amount ranges
  minAmount?: number;
  maxAmount?: number;
  
  // Reference filters
  referenceType?: string;
  referenceId?: string;
  referenceNumber?: string;
  
  // Text search
  searchText?: string;
  
  // Pagination
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

// Transaction summary for reporting
export interface TransactionSummary {
  period: string; // e.g., '2024-01', '2024-Q1'
  
  // Counts
  totalTransactions: number;
  saleCount: number;
  paymentCount: number;
  adjustmentCount: number;
  
  // Amounts
  totalAmount: number;
  saleAmount: number;
  paymentAmount: number;
  adjustmentAmount: number;
  
  // Averages
  averageTransactionAmount: number;
  averageDaysToPay?: number;
  
  // Payment method breakdown
  paymentMethodBreakdown: Record<PaymentMethod, {
    count: number;
    amount: number;
    percentage: number;
  }>;
  
  // Status breakdown
  statusBreakdown: Record<TransactionStatus, number>;
}

// Transaction reversal request
export interface TransactionReversalRequest {
  transactionId: string;
  reversalReason: string;
  reversalDate: Date;
  notes?: string;
  
  // Partial reversal (if not reversing entire amount)
  partialAmount?: number;
  partialReason?: string;
  
  // Approval
  requiresApproval: boolean;
  approvedBy?: string;
  approvedAt?: Date;
  approvalNotes?: string;
  
  // Created by
  reversedBy: string;
}

// Transaction audit trail entry
export interface TransactionAudit {
  id: string;
  transactionId: string;
  
  // Change details
  changedField: string;
  oldValue?: any;
  newValue?: any;
  
  // Change metadata
  changedBy: string;
  changedAt: Date;
  changeReason?: string;
  
  // IP/device info (for security)
  ipAddress?: string;
  userAgent?: string;
}

// Transaction import record (for bulk operations)
export interface TransactionImportRecord {
  rowNumber: number;
  customerCode: string;
  transactionDate: string;
  type: string;
  amount: string;
  currency?: string;
  description: string;
  referenceNumber?: string;
  
  // Validation results
  isValid: boolean;
  errors: string[];
  warnings: string[];
  
  // Import status
  importStatus: 'PENDING' | 'IMPORTED' | 'FAILED' | 'SKIPPED';
  importedTransactionId?: string;
  importError?: string;
}

// Transaction matching (for reconciliation)
export interface TransactionMatch {
  transactionId: string;
  matchedTransactionId?: string; // For payments matching invoices
  matchType: 'EXACT' | 'PARTIAL' | 'MANUAL';
  matchConfidence: number; // 0-100
  matchDate: Date;
  matchedBy: string;
  matchNotes?: string;
} 
