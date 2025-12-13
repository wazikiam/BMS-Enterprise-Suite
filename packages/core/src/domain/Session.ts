export interface Session {
  id: string;
  userId: string;
  token: string;
  refreshToken?: string;
  ipAddress?: string;
  userAgent?: string;
  deviceInfo?: string;
  createdAt: Date;
  expiresAt: Date;
  lastActivityAt: Date;
  isRevoked: boolean;
  revokedAt?: Date;
  revocationReason?: string;
}

export interface CreateSessionDTO {
  userId: string;
  token: string;
  refreshToken?: string;
  ipAddress?: string;
  userAgent?: string;
  deviceInfo?: string;
  expiresIn: number; // in seconds
}

export interface UpdateSessionDTO {
  lastActivityAt?: Date;
  isRevoked?: boolean;
  revokedAt?: Date;
  revocationReason?: string;
}

export interface SessionValidationResult {
  isValid: boolean;
  session?: Session;
  error?: string;
}

export interface TokenPayload {
  userId: string;
  role: string;
  email: string;
  sessionId: string;
  iat: number;
  exp: number;
}

export const SESSION_CONFIG = {
  ACCESS_TOKEN_EXPIRY: 3600, // 1 hour in seconds
  REFRESH_TOKEN_EXPIRY: 2592000, // 30 days in seconds
  SESSION_CLEANUP_INTERVAL: 86400, // 24 hours in seconds
  MAX_CONCURRENT_SESSIONS: 5
};

export function isSessionExpired(session: Session): boolean {
  return new Date() > session.expiresAt;
}

export function isSessionActive(session: Session): boolean {
  return !session.isRevoked && !isSessionExpired(session);
}

export function calculateExpiryDate(expiresIn: number): Date {
  const now = new Date();
  return new Date(now.getTime() + expiresIn * 1000);
}