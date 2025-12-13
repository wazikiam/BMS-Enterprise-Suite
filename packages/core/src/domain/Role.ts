// packages/core/src/domain/Role.ts

/**
 * ============================
 * AuthZ Domain — Role
 * ============================
 * Compatibility layer:
 * - Permission is owned by Permission.ts
 * - Re-exported here to avoid breaking services
 */

import { Permission } from './Permission';

/**
 * Re-export Permission for backward compatibility
 */
export { Permission };

export interface Role {
  id: string;
  name: string;
  description?: string;
  permissionIds: Permission[];
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
    description: 'Full system access',
    permissions: Object.values(Permission),
    isDefault: false
  },
  manager: {
    id: 'manager',
    name: 'Manager',
    description: 'Supervisory access',
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
      Permission.REPORT_READ
    ],
    isDefault: false
  },
  seller: {
    id: 'seller',
    name: 'Seller',
    description: 'Sales operations',
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
    description: 'Read-only access',
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

/**
 * Backward-compatible helpers
 * (read-only, no enforcement)
 */
export function hasPermission(roleId: string, permission: Permission): boolean {
  return ROLES[roleId]?.permissions.includes(permission) ?? false;
}

export function getUserPermissions(roleId: string): Permission[] {
  return ROLES[roleId]?.permissions ?? [];
}
