/**
 * Application Error Classes
 * Custom error types for business logic and validation
 *
 * BUSINESS RULES:
 * - Consistent error handling across all modules
 * - Type-safe error categorization
 * - Detailed error messages for debugging
 * - Support for error recovery strategies
 *
 * DESIGN RULES:
 * - TypeScript strict mode
 * - Extensible error hierarchy
 * - Proper error inheritance
 * - Serialization support
 */

/**
 * Base application error class
 * All custom errors should extend this class
 */
export class ApplicationError extends Error {
  public readonly timestamp: Date;
  public readonly code: string;
  public readonly details?: Record<string, any>;
  public readonly cause?: Error;

  constructor(
    message: string,
    options: {
      code?: string;
      details?: Record<string, any>;
      cause?: Error;
    } = {}
  ) {
    super(message);

    this.name = this.constructor.name;
    this.timestamp = new Date();
    this.code = options.code || 'APPLICATION_ERROR';
    this.details = options.details;
    this.cause = options.cause;

    // Maintains proper stack trace (only available in V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert error to JSON for API responses
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      timestamp: this.timestamp.toISOString(),
      details: this.details,
      stack: process.env.NODE_ENV === 'development' ? this.stack : undefined
    };
  }

  /**
   * Convert error to string for logging
   */
  toString(): string {
    return `[${this.code}] ${this.name}: ${this.message}`;
  }
}

/**
 * Business Rule Error for domain logic violations
 * Use when business rules are violated (e.g., credit limit exceeded, insufficient stock)
 */
export class BusinessRuleError extends ApplicationError {
  constructor(
    message: string,
    options: {
      ruleCode?: string;
      resourceType?: string;
      resourceId?: string | number;
      details?: Record<string, any>;
      cause?: Error;
    } = {}
  ) {
    super(message, {
      code: 'BUSINESS_RULE_ERROR',
      details: {
        ruleCode: options.ruleCode,
        resourceType: options.resourceType,
        resourceId: options.resourceId,
        ...options.details
      },
      cause: options.cause
    });
    this.name = 'BusinessRuleError';
  }

  /**
   * Create a business rule error for credit limit violation
   */
  static creditLimitExceeded(customerId: string, currentBalance: number, creditLimit: number): BusinessRuleError {
    return new BusinessRuleError(
      `Credit limit exceeded. Current balance: ${currentBalance}, Limit: ${creditLimit}`,
      {
        ruleCode: 'CREDIT_LIMIT_EXCEEDED',
        resourceType: 'Customer',
        resourceId: customerId,
        details: { currentBalance, creditLimit }
      }
    );
  }

  /**
   * Create a business rule error for insufficient stock
   */
  static insufficientStock(productId: string, requested: number, available: number): BusinessRuleError {
    return new BusinessRuleError(
      `Insufficient stock. Requested: ${requested}, Available: ${available}`,
      {
        ruleCode: 'INSUFFICIENT_STOCK',
        resourceType: 'Product',
        resourceId: productId,
        details: { requested, available }
      }
    );
  }

  /**
   * Create a business rule error for invalid status transition
   */
  static invalidStatusTransition(currentStatus: string, newStatus: string): BusinessRuleError {
    return new BusinessRuleError(
      `Invalid status transition from ${currentStatus} to ${newStatus}`,
      {
        ruleCode: 'INVALID_STATUS_TRANSITION',
        details: { currentStatus, newStatus }
      }
    );
  }
}

/**
 * Validation error for business rule violations
 * Use when user input or data fails validation
 */
export class ValidationError extends ApplicationError {
  constructor(
    message: string,
    options: {
      field?: string;
      value?: any;
      rule?: string;
      details?: Record<string, any>;
      cause?: Error;
    } = {}
  ) {
    super(message, {
      code: 'VALIDATION_ERROR',
      details: {
        field: options.field,
        value: options.value,
        rule: options.rule,
        ...options.details
      },
      cause: options.cause
    });
    this.name = 'ValidationError';
  }

  /**
   * Create a validation error for a specific field
   */
  static forField(field: string, message: string, value?: any): ValidationError {
    return new ValidationError(message, { field, value });
  }

  /**
   * Create a validation error for a business rule violation
   */
  static forRule(rule: string, message: string, details?: Record<string, any>): ValidationError {
    return new ValidationError(message, { rule, details });
  }
}

/**
 * Not found error for missing resources
 * Use when a requested resource doesn't exist
 */
export class NotFoundError extends ApplicationError {
  constructor(
    resourceType: string,
    resourceId: string | number,
    options: {
      details?: Record<string, any>;
      cause?: Error;
    } = {}
  ) {
    super(`${resourceType} with ID "${resourceId}" not found`, {
      code: 'NOT_FOUND_ERROR',
      details: {
        resourceType,
        resourceId,
        ...options.details
      },
      cause: options.cause
    });
    this.name = 'NotFoundError';
  }

  /**
   * Factory method for creating NotFoundError - ADDED THIS METHOD
   */
  static factory(resourceType: string, resourceId: string | number): NotFoundError {
    return new NotFoundError(resourceType, resourceId);
  }

  /**
   * Create a not found error for a product
   */
  static product(productId: string): NotFoundError {
    return new NotFoundError('Product', productId);
  }

  /**
   * Create a not found error for a category
   */
  static category(categoryId: string): NotFoundError {
    return new NotFoundError('Category', categoryId);
  }

  /**
   * Create a not found error for a parent category
   */
  static parentCategory(parentId: string): NotFoundError {
    return new NotFoundError('ParentCategory', parentId);
  }

  /**
   * Create a not found error for a customer
   */
  static customer(customerId: string): NotFoundError {
    return new NotFoundError('Customer', customerId);
  }

  /**
   * Create a not found error for stock level
   */
  static stockLevel(productId: string, locationId: string): NotFoundError {
    return new NotFoundError(
      'StockLevel',
      `${productId}:${locationId}`,
      { details: { productId, locationId } }
    );
  }

  /**
   * Create a not found error for stock reservation
   */
  static stockReservation(reservationId: string): NotFoundError {
    return new NotFoundError('StockReservation', reservationId);
  }

  /**
   * Create a not found error for payment
   */
  static payment(paymentId: string): NotFoundError {
    return new NotFoundError('Payment', paymentId);
  }

  /**
   * Create a not found error for sale order
   */
  static saleOrder(orderId: string): NotFoundError {
    return new NotFoundError('SaleOrder', orderId);
  }

  /**
   * Create a not found error for user
   */
  static user(userId: string): NotFoundError {
    return new NotFoundError('User', userId);
  }

  /**
   * Create a not found error for payment method
   */
  static paymentMethod(methodCode: string): NotFoundError {
    return new NotFoundError('PaymentMethod', methodCode);
  }

  /**
   * Create a not found error for credit override
   */
  static creditOverride(overrideId: string): NotFoundError {
    return new NotFoundError('CreditOverride', overrideId);
  }

  /**
   * ADDED: Create a not found error for CustomerBalance
   */
  static customerBalance(customerId: string): NotFoundError {
    return new NotFoundError('CustomerBalance', customerId);
  }

  /**
   * ADDED: Create a not found error for CreditLimit
   */
  static creditLimit(limitId: string): NotFoundError {
    return new NotFoundError('CreditLimit', limitId);
  }

  /**
   * ADDED: Create a not found error for BalanceTransaction
   */
  static balanceTransaction(transactionId: string): NotFoundError {
    return new NotFoundError('BalanceTransaction', transactionId);
  }

  /**
   * ADDED: Create a not found error for BalanceAdjustment
   */
  static balanceAdjustment(adjustmentId: string): NotFoundError {
    return new NotFoundError('BalanceAdjustment', adjustmentId);
  }

  /**
   * ADDED: Create a not found error for BalanceTransfer
   */
  static balanceTransfer(transferId: string): NotFoundError {
    return new NotFoundError('BalanceTransfer', transferId);
  }
}

/**
 * Authorization error for permission violations
 * Use when user doesn't have required permissions
 */
export class AuthorizationError extends ApplicationError {
  constructor(
    message: string = 'Access denied',
    options: {
      requiredPermission?: string;
      requiredRole?: string;
      details?: Record<string, any>;
      cause?: Error;
    } = {}
  ) {
    super(message, {
      code: 'AUTHORIZATION_ERROR',
      details: {
        requiredPermission: options.requiredPermission,
        requiredRole: options.requiredRole,
        ...options.details
      },
      cause: options.cause
    });
    this.name = 'AuthorizationError';
  }

  /**
   * Create authorization error for missing permission
   */
  static forPermission(permission: string): AuthorizationError {
    return new AuthorizationError(
      `Permission "${permission}" required`,
      { requiredPermission: permission }
    );
  }

  /**
   * Create authorization error for missing role
   */
  static forRole(role: string): AuthorizationError {
    return new AuthorizationError(
      `Role "${role}" required`,
      { requiredRole: role }
    );
  }
}

/**
 * Conflict error for duplicate or conflicting data
 * Use when creating/updating data causes conflicts
 */
export class ConflictError extends ApplicationError {
  constructor(
    message: string,
    options: {
      conflictField?: string;
      conflictValue?: any;
      existingResource?: string;
      details?: Record<string, any>;
      cause?: Error;
    } = {}
  ) {
    super(message, {
      code: 'CONFLICT_ERROR',
      details: {
        conflictField: options.conflictField,
        conflictValue: options.conflictValue,
        existingResource: options.existingResource,
        ...options.details
      },
      cause: options.cause
    });
    this.name = 'ConflictError';
  }

  /**
   * Create conflict error for duplicate SKU
   */
  static duplicateSku(sku: string): ConflictError {
    return new ConflictError(
      `Product with SKU "${sku}" already exists`,
      { conflictField: 'sku', conflictValue: sku }
    );
  }

  /**
   * Create conflict error for duplicate barcode
   */
  static duplicateBarcode(barcode: string): ConflictError {
    return new ConflictError(
      `Product with barcode "${barcode}" already exists`,
      { conflictField: 'barcode', conflictValue: barcode }
    );
  }
}

/**
 * Database error for data layer failures
 * Use for database-specific errors
 */
export class DatabaseError extends ApplicationError {
  constructor(
    message: string,
    options: {
      operation?: string;
      table?: string;
      query?: string;
      details?: Record<string, any>;
      cause?: Error;
    } = {}
  ) {
    super(message, {
      code: 'DATABASE_ERROR',
      details: {
        operation: options.operation,
        table: options.table,
        query: options.query,
        ...options.details
      },
      cause: options.cause
    });
    this.name = 'DatabaseError';
  }
}

/**
 * External service error for third-party API failures
 */
export class ExternalServiceError extends ApplicationError {
  constructor(
    serviceName: string,
    message: string,
    options: {
      endpoint?: string;
      statusCode?: number;
      response?: any;
      details?: Record<string, any>;
      cause?: Error;
    } = {}
  ) {
    super(`Service ${serviceName}: ${message}`, {
      code: 'EXTERNAL_SERVICE_ERROR',
      details: {
        serviceName,
        endpoint: options.endpoint,
        statusCode: options.statusCode,
        response: options.response,
        ...options.details
      },
      cause: options.cause
    });
    this.name = 'ExternalServiceError';
  }
}

/**
 * Configuration error for missing or invalid configuration
 */
export class ConfigurationError extends ApplicationError {
  constructor(
    configKey: string,
    message: string,
    options: {
      expectedType?: string;
      actualValue?: any;
      details?: Record<string, any>;
      cause?: Error;
    } = {}
  ) {
    super(`Configuration error for "${configKey}": ${message}`, {
      code: 'CONFIGURATION_ERROR',
      details: {
        configKey,
        expectedType: options.expectedType,
        actualValue: options.actualValue,
        ...options.details
      },
      cause: options.cause
    });
    this.name = 'ConfigurationError';
  }
}

/**
 * Utility function to check if error is of specific type
 */
export function isApplicationError(error: unknown): error is ApplicationError {
  return error instanceof ApplicationError;
}

/**
 * Utility function to convert any error to ApplicationError
 */
export function toApplicationError(error: unknown): ApplicationError {
  if (isApplicationError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new ApplicationError(error.message, {
      code: 'UNKNOWN_ERROR',
      cause: error,
      details: { originalError: error.name }
    });
  }

  return new ApplicationError(String(error), {
    code: 'UNKNOWN_ERROR',
    details: { originalError: error }
  });
}

/**
 * Error codes reference
 */
export const ERROR_CODES = {
  BUSINESS_RULE_ERROR: 'BUSINESS_RULE_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND_ERROR: 'NOT_FOUND_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  CONFLICT_ERROR: 'CONFLICT_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
  APPLICATION_ERROR: 'APPLICATION_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
} as const;

export default {
  ApplicationError,
  BusinessRuleError,
  ValidationError,
  NotFoundError,
  AuthorizationError,
  ConflictError,
  DatabaseError,
  ExternalServiceError,
  ConfigurationError,
  isApplicationError,
  toApplicationError,
  ERROR_CODES
};