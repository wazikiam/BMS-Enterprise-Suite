import { Permission } from '../domain/Role';
import { ModulePermission, MODULE_PERMISSIONS, canAccessModule, getAccessibleModules } from '../domain/Permission';

export interface IPermissionService {
  checkPermission(userPermissions: Permission[], requiredPermission: Permission): boolean;
  checkAnyPermission(userPermissions: Permission[], requiredPermissions: Permission[]): boolean;
  checkAllPermissions(userPermissions: Permission[], requiredPermissions: Permission[]): boolean;
  filterByPermission<T>(items: T[], userPermissions: Permission[], permissionExtractor: (item: T) => Permission[]): T[];
  getModulePermissions(module: string): ModulePermission | undefined;
  getUserAccessibleModules(userPermissions: Permission[]): string[];
  canUserAccessModule(userPermissions: Permission[], module: string): boolean;
  validatePermissionSet(permissions: Permission[]): { isValid: boolean; errors: string[] };
  getPermissionHierarchy(): Map<Permission, Permission[]>;
  hasPermissionInHierarchy(userPermissions: Permission[], targetPermission: Permission): boolean;
}

export class PermissionService implements IPermissionService {
  private readonly permissionHierarchy: Map<Permission, Permission[]>;

  constructor() {
    this.permissionHierarchy = this.buildPermissionHierarchy();
  }

  checkPermission(userPermissions: Permission[], requiredPermission: Permission): boolean {
    return userPermissions.includes(requiredPermission) || 
           this.hasPermissionInHierarchy(userPermissions, requiredPermission);
  }

  checkAnyPermission(userPermissions: Permission[], requiredPermissions: Permission[]): boolean {
    return requiredPermissions.some(permission => 
      this.checkPermission(userPermissions, permission)
    );
  }

  checkAllPermissions(userPermissions: Permission[], requiredPermissions: Permission[]): boolean {
    return requiredPermissions.every(permission => 
      this.checkPermission(userPermissions, permission)
    );
  }

  filterByPermission<T>(
    items: T[], 
    userPermissions: Permission[], 
    permissionExtractor: (item: T) => Permission[]
  ): T[] {
    return items.filter(item => {
      const itemPermissions = permissionExtractor(item);
      return this.checkAnyPermission(userPermissions, itemPermissions);
    });
  }

  getModulePermissions(module: string): ModulePermission | undefined {
    return MODULE_PERMISSIONS.find(mp => mp.module === module);
  }

  getUserAccessibleModules(userPermissions: Permission[]): string[] {
    return getAccessibleModules(userPermissions);
  }

  canUserAccessModule(userPermissions: Permission[], module: string): boolean {
    return canAccessModule(userPermissions, module);
  }

  validatePermissionSet(permissions: Permission[]): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const uniquePermissions = [...new Set(permissions)];

    // Check for invalid permissions
    const allValidPermissions = Object.values(Permission);
    const invalidPermissions = uniquePermissions.filter(
      p => !allValidPermissions.includes(p)
    );

    if (invalidPermissions.length > 0) {
      errors.push(`Invalid permissions: ${invalidPermissions.join(', ')}`);
    }

    // Check for permission conflicts
    const conflicts = this.findPermissionConflicts(uniquePermissions);
    if (conflicts.length > 0) {
      errors.push(`Permission conflicts: ${conflicts.join('; ')}`);
    }

    // Check for circular dependencies
    const circular = this.findCircularDependencies(uniquePermissions);
    if (circular.length > 0) {
      errors.push(`Circular dependencies: ${circular.join('; ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  getPermissionHierarchy(): Map<Permission, Permission[]> {
    return new Map(this.permissionHierarchy);
  }

  hasPermissionInHierarchy(userPermissions: Permission[], targetPermission: Permission): boolean {
    // Check if user has a parent permission that includes the target
    for (const [parent, children] of this.permissionHierarchy.entries()) {
      if (userPermissions.includes(parent) && children.includes(targetPermission)) {
        return true;
      }
    }
    return false;
  }

  getPermissionTree(): Map<Permission, { children: Permission[]; level: number }> {
    const tree = new Map<Permission, { children: Permission[]; level: number }>();
    
    // First pass: add all permissions with their children
    for (const [permission, children] of this.permissionHierarchy.entries()) {
      tree.set(permission, { children, level: 0 });
    }

    // Second pass: calculate levels
    let changed = true;
    while (changed) {
      changed = false;
      for (const [permission, data] of tree.entries()) {
        const childLevels = data.children
          .map(child => tree.get(child)?.level ?? -1)
          .filter(level => level !== -1);
        
        if (childLevels.length > 0) {
          const maxChildLevel = Math.max(...childLevels);
          if (data.level <= maxChildLevel) {
            tree.set(permission, { ...data, level: maxChildLevel + 1 });
            changed = true;
          }
        }
      }
    }

    return tree;
  }

  getRequiredPermissionsForModule(module: string): Permission[] {
    const modulePerm = this.getModulePermissions(module);
    if (!modulePerm) {
      return [];
    }

    // Get all permissions required for full module access
    return modulePerm.permissions;
  }

  getMinimumPermissionsForModule(module: string): Permission[] {
    const modulePerm = this.getModulePermissions(module);
    if (!modulePerm) {
      return [];
    }

    // For modules with multiple permissions, return the most basic one
    if (modulePerm.permissions.length > 0) {
      // Try to find a READ permission first
      const readPermission = modulePerm.permissions.find(p => p.includes(':read'));
      if (readPermission) {
        return [readPermission];
      }
      // Otherwise return the first permission
      return [modulePerm.permissions[0]];
    }

    return [];
  }

  private buildPermissionHierarchy(): Map<Permission, Permission[]> {
    const hierarchy = new Map<Permission, Permission[]>();

    // Define parent-child relationships between permissions
    hierarchy.set(Permission.USER_CREATE, [Permission.USER_READ, Permission.USER_UPDATE]);
    hierarchy.set(Permission.USER_UPDATE, [Permission.USER_READ]);
    hierarchy.set(Permission.USER_DELETE, [Permission.USER_READ]);

    hierarchy.set(Permission.PRODUCT_CREATE, [Permission.PRODUCT_READ, Permission.PRODUCT_UPDATE]);
    hierarchy.set(Permission.PRODUCT_UPDATE, [Permission.PRODUCT_READ]);
    hierarchy.set(Permission.PRODUCT_DELETE, [Permission.PRODUCT_READ]);

    hierarchy.set(Permission.SALE_CREATE, [Permission.SALE_READ]);
    hierarchy.set(Permission.SALE_UPDATE, [Permission.SALE_READ]);
    hierarchy.set(Permission.SALE_DELETE, [Permission.SALE_READ]);
    hierarchy.set(Permission.SALE_APPROVE, [Permission.SALE_READ]);

    hierarchy.set(Permission.CUSTOMER_CREATE, [Permission.CUSTOMER_READ, Permission.CUSTOMER_UPDATE]);
    hierarchy.set(Permission.CUSTOMER_UPDATE, [Permission.CUSTOMER_READ]);
    hierarchy.set(Permission.CUSTOMER_DELETE, [Permission.CUSTOMER_READ]);

    hierarchy.set(Permission.PURCHASE_CREATE, [Permission.PURCHASE_READ]);
    hierarchy.set(Permission.PURCHASE_UPDATE, [Permission.PURCHASE_READ]);
    hierarchy.set(Permission.PURCHASE_APPROVE, [Permission.PURCHASE_READ]);

    hierarchy.set(Permission.HR_UPDATE, [Permission.HR_READ]);
    hierarchy.set(Permission.REPORT_EXPORT, [Permission.REPORT_READ]);
    hierarchy.set(Permission.SETTINGS_UPDATE, [Permission.SETTINGS_READ]);

    // Override permissions are independent
    hierarchy.set(Permission.OVERRIDE_CREDIT_LIMIT, []);
    hierarchy.set(Permission.OVERRIDE_PRICE, []);
    hierarchy.set(Permission.OVERRIDE_DISCOUNT, []);

    return hierarchy;
  }

  private findPermissionConflicts(permissions: Permission[]): string[] {
    const conflicts: string[] = [];
    
    // Example conflict: Having both CREATE and no READ for same resource
    const resourceMap = new Map<string, Set<string>>();
    
    for (const permission of permissions) {
      const [resource, action] = permission.split(':');
      if (!resourceMap.has(resource)) {
        resourceMap.set(resource, new Set());
      }
      resourceMap.get(resource)!.add(action);
    }

    // Check for CREATE without READ
    for (const [resource, actions] of resourceMap.entries()) {
      if (actions.has('create') && !actions.has('read')) {
        conflicts.push(`${resource}:create requires ${resource}:read`);
      }
      if (actions.has('update') && !actions.has('read')) {
        conflicts.push(`${resource}:update requires ${resource}:read`);
      }
      if (actions.has('delete') && !actions.has('read')) {
        conflicts.push(`${resource}:delete requires ${resource}:read`);
      }
    }

    return conflicts;
  }

  private findCircularDependencies(permissions: Permission[]): string[] {
    // Simple circular dependency check in hierarchy
    const visited = new Set<Permission>();
    const stack = new Set<Permission>();
    const circular: string[] = [];

    const dfs = (permission: Permission) => {
      if (stack.has(permission)) {
        circular.push(`Circular dependency involving ${permission}`);
        return;
      }

      if (visited.has(permission)) {
        return;
      }

      visited.add(permission);
      stack.add(permission);

      const children = this.permissionHierarchy.get(permission) || [];
      for (const child of children) {
        if (permissions.includes(child)) {
          dfs(child);
        }
      }

      stack.delete(permission);
    };

    for (const permission of permissions) {
      if (!visited.has(permission)) {
        dfs(permission);
      }
    }

    return circular;
  }

  public explainPermission(permission: Permission): string {
    const explanations: Record<Permission, string> = {
      [Permission.USER_CREATE]: 'Allows creating new users in the system',
      [Permission.USER_READ]: 'Allows viewing user profiles and lists',
      [Permission.USER_UPDATE]: 'Allows modifying user information',
      [Permission.USER_DELETE]: 'Allows removing users from the system',
      
      [Permission.PRODUCT_CREATE]: 'Allows adding new products to inventory',
      [Permission.PRODUCT_READ]: 'Allows viewing product details and listings',
      [Permission.PRODUCT_UPDATE]: 'Allows modifying product information',
      [Permission.PRODUCT_DELETE]: 'Allows removing products from inventory',
      
      [Permission.SALE_CREATE]: 'Allows creating new sales orders',
      [Permission.SALE_READ]: 'Allows viewing sales history and details',
      [Permission.SALE_UPDATE]: 'Allows modifying sales orders',
      [Permission.SALE_DELETE]: 'Allows canceling or deleting sales',
      [Permission.SALE_APPROVE]: 'Allows approving sales that require validation',
      
      [Permission.CUSTOMER_CREATE]: 'Allows creating new customer profiles',
      [Permission.CUSTOMER_READ]: 'Allows viewing customer information',
      [Permission.CUSTOMER_UPDATE]: 'Allows modifying customer details',
      [Permission.CUSTOMER_DELETE]: 'Allows removing customers from the system',
      
      [Permission.INVENTORY_READ]: 'Allows viewing current stock levels',
      [Permission.INVENTORY_UPDATE]: 'Allows adjusting inventory quantities',
      
      [Permission.PURCHASE_CREATE]: 'Allows creating purchase orders',
      [Permission.PURCHASE_READ]: 'Allows viewing purchase history',
      [Permission.PURCHASE_UPDATE]: 'Allows modifying purchase orders',
      [Permission.PURCHASE_APPROVE]: 'Allows approving purchase orders',
      
      [Permission.HR_READ]: 'Allows viewing employee information',
      [Permission.HR_UPDATE]: 'Allows modifying employee records',
      
      [Permission.REPORT_READ]: 'Allows accessing system reports',
      [Permission.REPORT_EXPORT]: 'Allows exporting reports to PDF/Excel',
      
      [Permission.SETTINGS_READ]: 'Allows viewing system settings',
      [Permission.SETTINGS_UPDATE]: 'Allows modifying system configuration',
      
      [Permission.OVERRIDE_CREDIT_LIMIT]: 'Allows overriding customer credit limits',
      [Permission.OVERRIDE_PRICE]: 'Allows overriding standard pricing',
      [Permission.OVERRIDE_DISCOUNT]: 'Allows applying special discounts'
    };

    return explanations[permission] || 'No description available for this permission';
  }
}