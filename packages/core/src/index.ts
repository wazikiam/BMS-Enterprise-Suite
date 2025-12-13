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

/**
 * Product domain models
 */
export * from './domain/Product';

/**
 * Product category models with hierarchical support
 */
export * from './domain/ProductCategory';

/**
 * Stock movement and alert models
 */
export type { StockMovementType, StockMovementStatus } from './domain/StockMovement';
export * from './domain/StockMovement';

// WEEK 2: INVENTORY REPOSITORIES (CREATED)
// ====================================================================

/**
 * Product data access layer
 */
export * from './repositories/ProductRepository';

/**
 * Category data access layer with tree operations
 */
export * from './repositories/CategoryRepository';

/**
 * Stock management data access layer
 */
export * from './repositories/StockRepository';

/**
 * Fast search repository for 2000+ products
 */
export type { SearchOptions, SearchResult } from './repositories/SearchRepository';
export * from './repositories/SearchRepository';

// WEEK 2: INVENTORY SERVICES (CREATED)
// ====================================================================

/**
 * Product business logic service
 */
export * from './services/ProductService';

/**
 * Category business logic service
 */
export * from './services/CategoryService';

/**
 * Stock management business logic service
 */
export * from './services/StockService';

/**
 * Search and filtering business logic service
 */
export * from './services/SearchService';

/**
 * Stock alert management service
 */
export type { AlertRule, AlertNotification } from './services/StockAlertService';
export * from './services/StockAlertService';

/**
 * Bulk import/export service
 */
export type { ImportResult, ImportOptions, ImportTemplate } from './services/ImportService';
export * from './services/ImportService';

// WEEK 1: AUTHENTICATION MODULE (NOT YET IMPLEMENTED - COMMENTED OUT)
// ====================================================================
/*
// Domain exports
export * from './domain/User';
export * from './domain/Role';
export * from './domain/Permission';
export * from './domain/Session';

// Services exports
export * from './services/AuthService';
export * from './services/PasswordService';
export * from './services/SessionService';
export * from './services/RoleService';
export * from './services/PermissionService';
*/

// CORE CONSTANTS
// ====================================================================

/**
 * Core module version
 */
export const CORE_VERSION = '1.0.0';

/**
 * Supported user roles in the system
 */
export const SUPPORTED_ROLES = ['admin', 'manager', 'seller', 'viewer'] as const;

/**
 * Inventory module constants
 */
export const INVENTORY_CONSTANTS = {
  MAX_PRODUCTS: 2000,
  DEFAULT_STOCK_LOCATION: 'default',
  LOW_STOCK_THRESHOLD: 0.3, // 30% of minimum stock
  CRITICAL_STOCK_THRESHOLD: 0.2, // 20% of minimum stock
  BATCH_IMPORT_SIZE: 100,
  MAX_SEARCH_RESULTS: 50
} as const;

// UTILITY FUNCTIONS
// ====================================================================

/**
 * Create core module configuration
 */
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
      }
    },
    
    constants: {
      CORE_VERSION,
      SUPPORTED_ROLES,
      INVENTORY_CONSTANTS
    },
    
    /**
     * Check if a module is available
     */
    hasModule(moduleName: 'inventory' | 'authentication'): boolean {
      if (moduleName === 'inventory') return inventoryEnabled;
      if (moduleName === 'authentication') return authEnabled;
      return false;
    },
    
    /**
     * Get module exports
     */
    getModuleExports(moduleName: 'inventory' | 'authentication'): string[] {
      if (moduleName === 'inventory' && inventoryEnabled) {
        return this.modules.inventory.exports;
      }
      return [];
    }
  };
}

// HELPER FUNCTIONS FOR WEEK 2
// ====================================================================

/**
 * Validate SKU format
 */
export function isValidSku(sku: string): boolean {
  return /^[A-Z0-9\-_]+$/.test(sku);
}

/**
 * Calculate stock percentage
 */
export function calculateStockPercentage(current: number, minimum: number): number {
  if (minimum === 0) return 100;
  return (current / minimum) * 100;
}

/**
 * Get stock status based on levels
 */
export function getStockStatus(current: number, minimum: number): 'healthy' | 'low' | 'critical' | 'out' {
  if (current === 0) return 'out';
  if (current <= minimum * 0.2) return 'critical';
  if (current <= minimum) return 'low';
  return 'healthy';
}

/**
 * Format price for display
 */
export function formatPrice(amount: number, currency: string = 'MAD'): string {
  return `${amount.toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })} ${currency}`;
}

/**
 * Export ready check
 */
export function isCoreReady(): { ready: boolean; missing: string[] } {
  const missing: string[] = [];
  
  // Check Week 2 files exist
  const week2Files = [
    './domain/Product',
    './domain/ProductCategory',
    './domain/StockMovement',
    './services/ProductService',
    './services/CategoryService',
    './services/StockService'
  ];
  
  // Note: Actual file existence check would require dynamic import
  // This is a placeholder for build-time checking
  
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