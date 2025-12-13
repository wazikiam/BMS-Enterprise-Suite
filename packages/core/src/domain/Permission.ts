import { Permission as Perm } from './Role';

export interface ModulePermission {
  module: string;
  permissions: Perm[];
  requiredForAccess: boolean;
}

export interface RolePermission {
  roleId: string;
  modulePermissions: ModulePermission[];
}

export interface PermissionMatrix {
  [roleId: string]: {
    [module: string]: Perm[];
  };
}

export const MODULE_PERMISSIONS: ModulePermission[] = [
  {
    module: 'dashboard',
    permissions: [],
    requiredForAccess: true
  },
  {
    module: 'users',
    permissions: [Perm.USER_CREATE, Perm.USER_READ, Perm.USER_UPDATE, Perm.USER_DELETE],
    requiredForAccess: false
  },
  {
    module: 'products',
    permissions: [Perm.PRODUCT_CREATE, Perm.PRODUCT_READ, Perm.PRODUCT_UPDATE, Perm.PRODUCT_DELETE],
    requiredForAccess: false
  },
  {
    module: 'inventory',
    permissions: [Perm.INVENTORY_READ, Perm.INVENTORY_UPDATE],
    requiredForAccess: false
  },
  {
    module: 'sales',
    permissions: [Perm.SALE_CREATE, Perm.SALE_READ, Perm.SALE_UPDATE, Perm.SALE_DELETE, Perm.SALE_APPROVE],
    requiredForAccess: false
  },
  {
    module: 'customers',
    permissions: [Perm.CUSTOMER_CREATE, Perm.CUSTOMER_READ, Perm.CUSTOMER_UPDATE, Perm.CUSTOMER_DELETE],
    requiredForAccess: false
  },
  {
    module: 'purchases',
    permissions: [Perm.PURCHASE_CREATE, Perm.PURCHASE_READ, Perm.PURCHASE_UPDATE, Perm.PURCHASE_APPROVE],
    requiredForAccess: false
  },
  {
    module: 'hr',
    permissions: [Perm.HR_READ, Perm.HR_UPDATE],
    requiredForAccess: false
  },
  {
    module: 'reports',
    permissions: [Perm.REPORT_READ, Perm.REPORT_EXPORT],
    requiredForAccess: false
  },
  {
    module: 'settings',
    permissions: [Perm.SETTINGS_READ, Perm.SETTINGS_UPDATE],
    requiredForAccess: false
  }
];

export function getModulePermissions(module: string): ModulePermission | undefined {
  return MODULE_PERMISSIONS.find(mp => mp.module === module);
}

export function canAccessModule(rolePermissions: Perm[], module: string): boolean {
  const modulePerm = getModulePermissions(module);
  if (!modulePerm) return false;
  
  if (modulePerm.requiredForAccess) return true;
  
  // Check if user has at least one permission for this module
  return modulePerm.permissions.some(permission => 
    rolePermissions.includes(permission)
  );
}

export function getAccessibleModules(rolePermissions: Perm[]): string[] {
  return MODULE_PERMISSIONS
    .filter(mp => canAccessModule(rolePermissions, mp.module))
    .map(mp => mp.module);
}