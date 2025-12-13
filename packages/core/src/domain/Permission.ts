// packages/core/src/domain/Permission.ts

/**
 * ============================
 * AuthZ Domain — Permission
 * ============================
 */

export enum Permission {
  // User Management
  USER_CREATE = 'user:create',
  USER_READ = 'user:read',
  USER_UPDATE = 'user:update',
  USER_DELETE = 'user:delete',

  // Product Management
  PRODUCT_CREATE = 'product:create',
  PRODUCT_READ = 'product:read',
  PRODUCT_UPDATE = 'product:update',
  PRODUCT_DELETE = 'product:delete',

  // Sales Management
  SALE_CREATE = 'sale:create',
  SALE_READ = 'sale:read',
  SALE_UPDATE = 'sale:update',
  SALE_DELETE = 'sale:delete',
  SALE_APPROVE = 'sale:approve',

  // Customer Management
  CUSTOMER_CREATE = 'customer:create',
  CUSTOMER_READ = 'customer:read',
  CUSTOMER_UPDATE = 'customer:update',
  CUSTOMER_DELETE = 'customer:delete',

  // Inventory Management
  INVENTORY_READ = 'inventory:read',
  INVENTORY_UPDATE = 'inventory:update',

  // Purchase Management
  PURCHASE_CREATE = 'purchase:create',
  PURCHASE_READ = 'purchase:read',
  PURCHASE_UPDATE = 'purchase:update',
  PURCHASE_APPROVE = 'purchase:approve',

  // HR Management
  HR_READ = 'hr:read',
  HR_UPDATE = 'hr:update',

  // Reports
  REPORT_READ = 'report:read',
  REPORT_EXPORT = 'report:export',

  // System Settings
  SETTINGS_READ = 'settings:read',
  SETTINGS_UPDATE = 'settings:update',

  // Overrides
  OVERRIDE_CREDIT_LIMIT = 'override:credit_limit',
  OVERRIDE_PRICE = 'override:price',
  OVERRIDE_DISCOUNT = 'override:discount'
}

export interface ModulePermission {
  module: string;
  permissions: Permission[];
  requiredForAccess: boolean;
}

export const MODULE_PERMISSIONS: ModulePermission[] = [
  { module: 'dashboard', permissions: [], requiredForAccess: true },
  { module: 'users', permissions: [Permission.USER_CREATE, Permission.USER_READ, Permission.USER_UPDATE, Permission.USER_DELETE], requiredForAccess: false },
  { module: 'products', permissions: [Permission.PRODUCT_CREATE, Permission.PRODUCT_READ, Permission.PRODUCT_UPDATE, Permission.PRODUCT_DELETE], requiredForAccess: false },
  { module: 'inventory', permissions: [Permission.INVENTORY_READ, Permission.INVENTORY_UPDATE], requiredForAccess: false },
  { module: 'sales', permissions: [Permission.SALE_CREATE, Permission.SALE_READ, Permission.SALE_UPDATE, Permission.SALE_DELETE, Permission.SALE_APPROVE], requiredForAccess: false },
  { module: 'customers', permissions: [Permission.CUSTOMER_CREATE, Permission.CUSTOMER_READ, Permission.CUSTOMER_UPDATE, Permission.CUSTOMER_DELETE], requiredForAccess: false },
  { module: 'purchases', permissions: [Permission.PURCHASE_CREATE, Permission.PURCHASE_READ, Permission.PURCHASE_UPDATE, Permission.PURCHASE_APPROVE], requiredForAccess: false },
  { module: 'hr', permissions: [Permission.HR_READ, Permission.HR_UPDATE], requiredForAccess: false },
  { module: 'reports', permissions: [Permission.REPORT_READ, Permission.REPORT_EXPORT], requiredForAccess: false },
  { module: 'settings', permissions: [Permission.SETTINGS_READ, Permission.SETTINGS_UPDATE], requiredForAccess: false }
];

export function getModulePermissions(module: string): ModulePermission | undefined {
  return MODULE_PERMISSIONS.find(mp => mp.module === module);
}

export function canAccessModule(rolePermissions: Permission[], module: string): boolean {
  const modulePerm = getModulePermissions(module);
  if (!modulePerm) return false;
  if (modulePerm.requiredForAccess) return true;
  return modulePerm.permissions.some(p => rolePermissions.includes(p));
}

export function getAccessibleModules(rolePermissions: Permission[]): string[] {
  return MODULE_PERMISSIONS
    .filter(mp => canAccessModule(rolePermissions, mp.module))
    .map(mp => mp.module);
}
