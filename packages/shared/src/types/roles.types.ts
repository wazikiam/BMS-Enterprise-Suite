export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  SELLER = 'seller',
  VIEWER = 'viewer'
}

export interface UserRoleInfo {
  role: UserRole;
  name: string;
}

export function getRoleInfo(role: UserRole): UserRoleInfo {
  const info = {
    [UserRole.ADMIN]: { role: UserRole.ADMIN, name: 'Admin' },
    [UserRole.MANAGER]: { role: UserRole.MANAGER, name: 'Manager' },
    [UserRole.SELLER]: { role: UserRole.SELLER, name: 'Seller' },
    [UserRole.VIEWER]: { role: UserRole.VIEWER, name: 'Viewer' }
  };
  return info[role];
}

export function isValidRole(role: string): boolean {
  return Object.values(UserRole).includes(role as UserRole);
}