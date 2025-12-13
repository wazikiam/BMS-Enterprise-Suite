import { Permission, ROLES, RoleDefinition, hasPermission, getUserPermissions } from '../domain/Role';
import { ModulePermission, getAccessibleModules, canAccessModule } from '../domain/Permission';

export interface IRoleService {
  getAllRoles(): RoleDefinition[];
  getRoleById(roleId: string): RoleDefinition | null;
  getUserPermissions(roleId: string): Permission[];
  hasPermission(roleId: string, permission: Permission): boolean;
  getAccessibleModules(roleId: string): string[];
  canAccessModule(roleId: string, module: string): boolean;
  updateRolePermissions(roleId: string, permissions: Permission[]): RoleDefinition;
  createCustomRole(name: string, description: string, permissions: Permission[]): RoleDefinition;
  validateRoleTransition(fromRole: string, toRole: string): boolean;
}

export class RoleService implements IRoleService {
  private customRoles: Map<string, RoleDefinition> = new Map();

  getAllRoles(): RoleDefinition[] {
    const builtInRoles = Object.values(ROLES);
    const customRoles = Array.from(this.customRoles.values());
    return [...builtInRoles, ...customRoles];
  }

  getRoleById(roleId: string): RoleDefinition | null {
    // Check built-in roles first
    if (ROLES[roleId]) {
      return ROLES[roleId];
    }
    
    // Check custom roles
    return this.customRoles.get(roleId) || null;
  }

  getUserPermissions(roleId: string): Permission[] {
    return getUserPermissions(roleId);
  }

  hasPermission(roleId: string, permission: Permission): boolean {
    return hasPermission(roleId, permission);
  }

  getAccessibleModules(roleId: string): string[] {
    const permissions = this.getUserPermissions(roleId);
    return getAccessibleModules(permissions);
  }

  canAccessModule(roleId: string, module: string): boolean {
    const permissions = this.getUserPermissions(roleId);
    return canAccessModule(permissions, module);
  }

  updateRolePermissions(roleId: string, permissions: Permission[]): RoleDefinition {
    const role = this.getRoleById(roleId);
    if (!role) {
      throw new Error(`Role ${roleId} not found`);
    }

    // Cannot modify built-in admin role permissions
    if (roleId === 'admin') {
      throw new Error('Cannot modify admin role permissions');
    }

    // Validate permissions are unique
    const uniquePermissions = [...new Set(permissions)];
    
    const updatedRole: RoleDefinition = {
      ...role,
      permissions: uniquePermissions
    };

    // Update in appropriate storage
    if (this.customRoles.has(roleId)) {
      this.customRoles.set(roleId, updatedRole);
    } else if (ROLES[roleId]) {
      // For built-in roles (except admin), we create a custom copy
      const customRoleId = `${roleId}_custom_${Date.now()}`;
      const customRole: RoleDefinition = {
        ...updatedRole,
        id: customRoleId,
        isDefault: false
      };
      this.customRoles.set(customRoleId, customRole);
      return customRole;
    }

    return updatedRole;
  }

  createCustomRole(name: string, description: string, permissions: Permission[]): RoleDefinition {
    // Validate name uniqueness
    const allRoles = this.getAllRoles();
    if (allRoles.some(role => role.name.toLowerCase() === name.toLowerCase())) {
      throw new Error(`Role with name "${name}" already exists`);
    }

    // Validate permissions are unique
    const uniquePermissions = [...new Set(permissions)];

    const roleId = `custom_${name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;
    
    const customRole: RoleDefinition = {
      id: roleId,
      name,
      description,
      permissions: uniquePermissions,
      isDefault: false
    };

    this.customRoles.set(roleId, customRole);
    return customRole;
  }

  validateRoleTransition(fromRole: string, toRole: string): boolean {
    // Cannot demote from admin
    if (fromRole === 'admin' && toRole !== 'admin') {
      return false;
    }

    // Only admin can assign admin role
    if (toRole === 'admin' && fromRole !== 'admin') {
      return false;
    }

    // Managers cannot assign manager role (only admin can)
    if (toRole === 'manager' && fromRole !== 'admin') {
      return false;
    }

    return true;
  }

  getRoleHierarchy(): Map<string, string[]> {
    const hierarchy = new Map<string, string[]>();
    
    hierarchy.set('admin', ['manager', 'seller', 'viewer']);
    hierarchy.set('manager', ['seller', 'viewer']);
    hierarchy.set('seller', ['viewer']);
    hierarchy.set('viewer', []);

    // Add custom roles - they have no subordinates by default
    this.customRoles.forEach(role => {
      hierarchy.set(role.id, []);
    });

    return hierarchy;
  }

  canManageRole(managerRole: string, targetRole: string): boolean {
    const hierarchy = this.getRoleHierarchy();
    const manageableRoles = hierarchy.get(managerRole) || [];
    
    return manageableRoles.includes(targetRole) || managerRole === targetRole;
  }

  getDefaultRole(): RoleDefinition {
    return Object.values(ROLES).find(role => role.isDefault) || ROLES.seller;
  }

  deleteCustomRole(roleId: string): boolean {
    if (!this.customRoles.has(roleId)) {
      return false;
    }

    // Check if role is in use (would need user repository in real implementation)
    // For now, just delete
    return this.customRoles.delete(roleId);
  }

  getRoleUsageStats(): Map<string, number> {
    // In real implementation, this would query user repository
    // For now, return empty map
    return new Map();
  }

  exportRoleConfiguration(roleId: string): string {
    const role = this.getRoleById(roleId);
    if (!role) {
      throw new Error(`Role ${roleId} not found`);
    }

    return JSON.stringify({
      id: role.id,
      name: role.name,
      description: role.description,
      permissions: role.permissions,
      isDefault: role.isDefault,
      exportDate: new Date().toISOString()
    }, null, 2);
  }

  importRoleConfiguration(config: string): RoleDefinition {
    const parsed = JSON.parse(config);
    
    // Validate required fields
    if (!parsed.name || !Array.isArray(parsed.permissions)) {
      throw new Error('Invalid role configuration');
    }

    // Check if permissions are valid
    const allPermissions = Object.values(Permission);
    const invalidPermissions = parsed.permissions.filter((p: string) => !allPermissions.includes(p as Permission));
    
    if (invalidPermissions.length > 0) {
      throw new Error(`Invalid permissions: ${invalidPermissions.join(', ')}`);
    }

    return this.createCustomRole(parsed.name, parsed.description || '', parsed.permissions);
  }
}