// packages/core/src/domain/CustomerSegment.ts
export interface CustomerSegment {
  id: string;
  name: string;
  description?: string;
  
  // Segment criteria
  criteria: SegmentCriteria;
  
  // Visual identification
  color: string;
  icon?: string;
  
  // Statistics
  customerCount: number;
  totalBalance: number;
  averageTransactionValue: number;
  
  // Metadata
  isSystemSegment: boolean;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  
  // Business rules
  autoAssign: boolean;
  priority: number; // 1-10, higher = more important
}

// Segment criteria for dynamic segmentation
export interface SegmentCriteria {
  type: 'STATIC' | 'DYNAMIC';
  
  // Static criteria (explicit customer IDs)
  customerIds?: string[];
  
  // Dynamic criteria (rules-based)
  rules?: SegmentRule[];
  
  // Combination logic
  combinationLogic: 'ALL' | 'ANY' | 'NONE';
}

// Individual segment rule
export interface SegmentRule {
  field: SegmentField;
  operator: SegmentOperator;
  value: string | number | Date | boolean | string[];
  valueType: 'STRING' | 'NUMBER' | 'DATE' | 'BOOLEAN' | 'ARRAY';
}

// Available fields for segmentation
export enum SegmentField {
  CUSTOMER_TYPE = 'CUSTOMER_TYPE',
  STATUS = 'STATUS',
  TAGS = 'TAGS',
  CREDIT_LIMIT = 'CREDIT_LIMIT',
  CURRENT_BALANCE = 'CURRENT_BALANCE',
  TOTAL_PURCHASES = 'TOTAL_PURCHASES',
  AVERAGE_TRANSACTION_VALUE = 'AVERAGE_TRANSACTION_VALUE',
  LAST_PURCHASE_DATE = 'LAST_PURCHASE_DATE',
  CREATED_DATE = 'CREATED_DATE',
  ASSIGNED_SELLER = 'ASSIGNED_SELLER',
  HAS_EMAIL = 'HAS_EMAIL',
  HAS_COMPANY_NAME = 'HAS_COMPANY_NAME',
  HAS_TAX_ID = 'HAS_TAX_ID',
}

// Available operators for segmentation
export enum SegmentOperator {
  EQUALS = 'EQUALS',
  NOT_EQUALS = 'NOT_EQUALS',
  CONTAINS = 'CONTAINS',
  NOT_CONTAINS = 'NOT_CONTAINS',
  STARTS_WITH = 'STARTS_WITH',
  ENDS_WITH = 'ENDS_WITH',
  GREATER_THAN = 'GREATER_THAN',
  LESS_THAN = 'LESS_THAN',
  GREATER_THAN_OR_EQUAL = 'GREATER_THAN_OR_EQUAL',
  LESS_THAN_OR_EQUAL = 'LESS_THAN_OR_EQUAL',
  BETWEEN = 'BETWEEN',
  IN = 'IN',
  NOT_IN = 'NOT_IN',
  IS_EMPTY = 'IS_EMPTY',
  IS_NOT_EMPTY = 'IS_NOT_EMPTY',
  IS_TRUE = 'IS_TRUE',
  IS_FALSE = 'IS_FALSE',
}

// Segment creation input
export interface CustomerSegmentCreateInput {
  name: string;
  description?: string;
  criteria: SegmentCriteria;
  color: string;
  icon?: string;
  autoAssign?: boolean;
  priority?: number;
}

// Segment update input
export interface CustomerSegmentUpdateInput {
  name?: string;
  description?: string;
  criteria?: SegmentCriteria;
  color?: string;
  icon?: string;
  isActive?: boolean;
  autoAssign?: boolean;
  priority?: number;
}

// Segment evaluation result
export interface SegmentEvaluationResult {
  segmentId: string;
  customerId: string;
  matches: boolean;
  matchedRules: string[];
  score: number;
  evaluatedAt: Date;
}

// Segment statistics
export interface SegmentStats {
  segmentId: string;
  name: string;
  customerCount: number;
  totalBalance: number;
  averageBalance: number;
  minBalance: number;
  maxBalance: number;
  averageTransactionValue: number;
  lastUpdated: Date;
  growthRate?: number; // Percentage growth over last period
}

// System-defined segments (pre-configured)
export enum SystemSegments {
  HIGH_VALUE = 'HIGH_VALUE',
  FREQUENT_BUYER = 'FREQUENT_BUYER',
  NEW_CUSTOMER = 'NEW_CUSTOMER',
  INACTIVE = 'INACTIVE',
  OVERDUE = 'OVERDUE',
  CORPORATE = 'CORPORATE',
  RETAIL = 'RETAIL',
} 
