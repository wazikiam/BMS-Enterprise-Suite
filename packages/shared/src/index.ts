// Minimal exports for now
export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  SELLER = 'seller',
  VIEWER = 'viewer'
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: Date;
}

export interface ApiError extends ApiResponse {
  statusCode: number;
}

// API Response helpers
export function createSuccessResponse<T>(data: T, message?: string): ApiResponse<T> {
  return {
    success: true,
    data,
    message,
    timestamp: new Date()
  };
}

export function createErrorResponse(error: string, statusCode: number = 400): ApiError {
  return {
    success: false,
    error,
    statusCode,
    timestamp: new Date()
  };
}

// Common constants
export const APP_VERSION = '1.0.0';
export const SUPPORTED_LANGUAGES = ['en', 'fr', 'ar'] as const;
export const DEFAULT_LANGUAGE = 'fr';
export const DATE_FORMAT = 'dd-mm-yyyy';