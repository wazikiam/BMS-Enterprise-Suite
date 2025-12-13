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
  
  // Override Permissions
  OVERRIDE_CREDIT_LIMIT = 'override:credit_limit',
  OVERRIDE_PRICE = 'override:price',
  OVERRIDE_DISCOUNT = 'override:discount'
}

export interface RoleDefinition {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  isDefault: boolean;
}

export const ROLES: Record<string, RoleDefinition> = {
  admin: {
    id: 'admin',
    name: 'Administrator',
    description: 'Full system access with all permissions',
    permissions: Object.values(Permission),
    isDefault: false
  },
  manager: {
    id: 'manager',
    name: 'Manager',
    description: 'Supervisory access with approval capabilities',
    permissions: [
      Permission.USER_READ,
      Permission.PRODUCT_READ,
      Permission.PRODUCT_UPDATE,
      Permission.SALE_CREATE,
      Permission.SALE_READ,
      Permission.SALE_UPDATE,
      Permission.SALE_APPROVE,
      Permission.CUSTOMER_CREATE,
      Permission.CUSTOMER_READ,
      Permission.CUSTOMER_UPDATE,
      Permission.INVENTORY_READ,
      Permission.INVENTORY_UPDATE,
      Permission.PURCHASE_READ,
      Permission.PURCHASE_APPROVE,
      Permission.HR_READ,
      Permission.REPORT_READ,
      Permission.REPORT_EXPORT,
      Permission.SETTINGS_READ,
      Permission.OVERRIDE_CREDIT_LIMIT,
      Permission.OVERRIDE_PRICE,
      Permission.OVERRIDE_DISCOUNT
    ],
    isDefault: false
  },
  seller: {
    id: 'seller',
    name: 'Seller',
    description: 'Sales operations with limited permissions',
    permissions: [
      Permission.PRODUCT_READ,
      Permission.SALE_CREATE,
      Permission.SALE_READ,
      Permission.CUSTOMER_CREATE,
      Permission.CUSTOMER_READ,
      Permission.INVENTORY_READ
    ],
    isDefault: true
  },
  viewer: {
    id: 'viewer',
    name: 'Viewer',
    description: 'Read-only access for auditing',
    permissions: [
      Permission.USER_READ,
      Permission.PRODUCT_READ,
      Permission.SALE_READ,
      Permission.CUSTOMER_READ,
      Permission.INVENTORY_READ,
      Permission.REPORT_READ
    ],
    isDefault: false
  }
};

export function hasPermission(role: string, permission: Permission): boolean {
  return ROLES[role]?.permissions.includes(permission) || false;
}

export function getUserPermissions(role: string): Permission[] {
  return ROLES[role]?.permissions || [];
}