// Domain exports
export * from './src/domain/User';
export * from './src/domain/Role';
export * from './src/domain/Permission';
export * from './src/domain/Session';

// Services exports
export * from './src/services/AuthService';
export * from './src/services/PasswordService';
export * from './src/services/SessionService';
export * from './src/services/RoleService';
export * from './src/services/PermissionService';

// Re-export types for convenience
export type { 
  IAuthService,
  ISessionService,
  IRoleService,
  IPermissionService 
} from './src/services/AuthService';

export type {
  PasswordValidationResult,
  PasswordPolicy
} from './src/services/PasswordService';

export type {
  SessionValidationResult
} from './src/services/SessionService';

// Constants
export const CORE_VERSION = '1.0.0';
export const SUPPORTED_ROLES = ['admin', 'manager', 'seller', 'viewer'] as const;

// Utility functions
export function createCoreModule(config?: { version?: string }) {
  return {
    version: config?.version || CORE_VERSION,
    name: '@bms/core',
    description: 'Business Management System Core Module',
    exports: {
      domain: {
        User: 'User models and interfaces',
        Role: 'Role definitions and permissions',
        Permission: 'Permission management',
        Session: 'Session management'
      },
      services: {
        AuthService: 'Authentication and authorization',
        PasswordService: 'Password management and validation',
        SessionService: 'Session handling',
        RoleService: 'Role-based access control',
        PermissionService: 'Permission checking and validation'
      }
    }
  };
}