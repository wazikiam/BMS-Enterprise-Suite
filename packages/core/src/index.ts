// ====================================================================
// CORE PACKAGE EXPORTS - WEEK 2 FOCUS (INVENTORY MODULE)
// ====================================================================
// Note: Week 1 exports are commented out until Authentication module is ready
// ====================================================================

// APPLICATION ERRORS (IMPORTED FROM ERRORS MODULE)
// ====================================================================

export { 
  ApplicationError,
  ValidationError, 
  NotFoundError,
  AuthorizationError,
  ConflictError,
  DatabaseError,
  isApplicationError,
  toApplicationError,
  ERROR_CODES
} from './errors/ApplicationError';

// WEEK 2: INVENTORY DOMAIN MODELS (CREATED)
// ====================================================================

export * from './domain/Product';
export * from './domain/ProductCategory';
export type { StockMovementType, StockMovementStatus } from './domain/StockMovement';
export * from './domain/StockMovement';

// WEEK 2: INVENTORY REPOSITORIES (CREATED)
// ====================================================================

export * from './repositories/ProductRepository';
export * from './repositories/CategoryRepository';
export * from './repositories/StockRepository';
export type { SearchOptions, SearchResult } from './repositories/SearchRepository';
export * from './repositories/SearchRepository';

// WEEK 2: INVENTORY SERVICES (CREATED)
// ====================================================================

export * from './services/ProductService';
export * from './services/CategoryService';
export * from './services/StockService';
export * from './services/SearchService';
export type { AlertRule, AlertNotification } from './services/StockAlertService';
export * from './services/StockAlertService';
export type { ImportResult, ImportOptions, ImportTemplate } from './services/ImportService';
export * from './services/ImportService';

// ====================================================================
// PHASE 4.3 — ACCOUNTS RECEIVABLE PAYMENTS (AUDIT-GRADE)
// ====================================================================
// NOTE:
// We avoid `export *` collisions by explicitly aliasing `assertNever`
// ====================================================================

export {
  ARPaymentEvent,
  ARPaymentEventType,
  ARPaymentMethod,
  ARPaymentAllocationMethod,
  ARPaymentCreated,
  ARPaymentVoided,
  ARPaymentAppliedToInvoice,
  ARPaymentUnappliedFromInvoice,
  ARPaymentExternalReferenceLinked,
  ARPaymentExternalReferenceUnlinked,
  ARPaymentMemoUpdated,
  assertNever as assertNeverARPaymentEvent
} from './ar/payments/ARPaymentEvents';

export {
  ARPaymentCommand,
  ARPaymentCommandType,
  CreateARPayment,
  VoidARPayment,
  ApplyARPaymentToInvoice,
  UnapplyARPaymentFromInvoice,
  LinkARPaymentExternalReference,
  UnlinkARPaymentExternalReference,
  UpdateARPaymentMemo,
  assertNever as assertNeverARPaymentCommand
} from './ar/payments/ARPaymentCommands';

export * from './ar/payments/ARPaymentAggregate';
export * from './ar/payments/ARPaymentDecider';
export * from './ar/payments/ARPaymentInvariants';

// WEEK 1: AUTHENTICATION MODULE (NOT YET IMPLEMENTED - COMMENTED OUT)
// ====================================================================
/*
export * from './domain/User';
export * from './domain/Role';
export * from './domain/Permission';
export * from './domain/Session';

export * from './services/AuthService';
export * from './services/PasswordService';
export * from './services/SessionService';
export * from './services/RoleService';
export * from './services/PermissionService';
*/

// CORE CONSTANTS
// ====================================================================

export const CORE_VERSION = '1.0.0';

export const SUPPORTED_ROLES = ['admin', 'manager', 'seller', 'viewer'] as const;

export const INVENTORY_CONSTANTS = {
  MAX_PRODUCTS: 2000,
  DEFAULT_STOCK_LOCATION: 'default',
  LOW_STOCK_THRESHOLD: 0.3,
  CRITICAL_STOCK_THRESHOLD: 0.2,
  BATCH_IMPORT_SIZE: 100,
  MAX_SEARCH_RESULTS: 50
} as const;

// UTILITY FUNCTIONS
// ====================================================================

export function createCoreModule(config?: { 
  version?: string;
  enableInventory?: boolean;
  enableAuth?: boolean;
}) {
  const inventoryEnabled = config?.enableInventory !== false;
  const authEnabled = config?.enableAuth || false;

  return {
    version: config?.version || CORE_VERSION,
    name: '@bms/core',
    description: 'Business Management System Core Module',
    
    modules: {
      inventory: {
        enabled: inventoryEnabled,
        description: 'Inventory Management Module (Week 2)',
        status: 'IMPLEMENTED',
        exports: [
          'Product',
          'ProductCategory', 
          'StockMovement',
          'ProductService',
          'CategoryService',
          'StockService',
          'SearchService',
          'StockAlertService',
          'ImportService'
        ]
      },
      authentication: {
        enabled: authEnabled,
        description: 'Authentication Module (Week 1)',
        status: 'PENDING',
        exports: []
      },
      arPayments: {
        enabled: true,
        description: 'Accounts Receivable Payments (Phase 4.3)',
        status: 'IMPLEMENTED',
        exports: [
          'ARPaymentEvents',
          'ARPaymentAggregate',
          'ARPaymentCommands',
          'ARPaymentDecider',
          'ARPaymentInvariants'
        ]
      }
    },

    hasModule(moduleName: 'inventory' | 'authentication' | 'arPayments'): boolean {
      if (moduleName === 'inventory') return inventoryEnabled;
      if (moduleName === 'authentication') return authEnabled;
      if (moduleName === 'arPayments') return true;
      return false;
    },

    getModuleExports(moduleName: 'inventory' | 'authentication' | 'arPayments'): string[] {
      if (moduleName === 'inventory' && inventoryEnabled) {
        return this.modules.inventory.exports;
      }
      if (moduleName === 'arPayments') {
        return this.modules.arPayments.exports;
      }
      return [];
    }
  };
}

// HELPER FUNCTIONS FOR WEEK 2
// ====================================================================

export function isValidSku(sku: string): boolean {
  return /^[A-Z0-9\-_]+$/.test(sku);
}

export function calculateStockPercentage(current: number, minimum: number): number {
  if (minimum === 0) return 100;
  return (current / minimum) * 100;
}

export function getStockStatus(
  current: number,
  minimum: number
): 'healthy' | 'low' | 'critical' | 'out' {
  if (current === 0) return 'out';
  if (current <= minimum * 0.2) return 'critical';
  if (current <= minimum) return 'low';
  return 'healthy';
}

export function formatPrice(amount: number, currency: string = 'MAD'): string {
  return `${amount.toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })} ${currency}`;
}

export function isCoreReady(): { ready: boolean; missing: string[] } {
  const missing: string[] = [];
  return {
    ready: missing.length === 0,
    missing
  };
}

export default {
  createCoreModule,
  isCoreReady,
  CORE_VERSION,
  SUPPORTED_ROLES,
  INVENTORY_CONSTANTS
};
