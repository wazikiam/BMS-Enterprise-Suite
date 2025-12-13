import { Session, CreateSessionDTO, UpdateSessionDTO, SessionValidationResult, SESSION_CONFIG, calculateExpiryDate, isSessionActive } from '../domain/Session';

export interface ISessionService {
  createSession(sessionData: CreateSessionDTO): Promise<Session>;
  getSessionById(sessionId: string): Promise<Session | null>;
  getSessionByToken(token: string): Promise<Session | null>;
  getSessionsByUserId(userId: string): Promise<Session[]>;
  updateSession(sessionId: string, updates: UpdateSessionDTO): Promise<Session>;
  revokeSession(sessionId: string, reason?: string): Promise<void>;
  revokeAllUserSessions(userId: string, reason?: string): Promise<void>;
  cleanupExpiredSessions(): Promise<number>;
  validateSession(token: string): Promise<SessionValidationResult>;
  enforceSessionLimit(userId: string): Promise<void>;
}

export class SessionService implements ISessionService {
  constructor(private sessionRepository: any) {} // Will be replaced with actual repository

  async createSession(sessionData: CreateSessionDTO): Promise<Session> {
    // Enforce session limit
    await this.enforceSessionLimit(sessionData.userId);

    const session: Session = {
      id: this.generateSessionId(),
      userId: sessionData.userId,
      token: sessionData.token,
      refreshToken: sessionData.refreshToken,
      ipAddress: sessionData.ipAddress,
      userAgent: sessionData.userAgent,
      deviceInfo: sessionData.deviceInfo,
      createdAt: new Date(),
      expiresAt: calculateExpiryDate(sessionData.expiresIn),
      lastActivityAt: new Date(),
      isRevoked: false
    };

    return this.sessionRepository.create(session);
  }

  async getSessionById(sessionId: string): Promise<Session | null> {
    return this.sessionRepository.findById(sessionId);
  }

  async getSessionByToken(token: string): Promise<Session | null> {
    return this.sessionRepository.findByToken(token);
  }

  async getSessionsByUserId(userId: string): Promise<Session[]> {
    const sessions = await this.sessionRepository.findByUserId(userId);
    return sessions.filter((session: Session) => isSessionActive(session));
  }

  async updateSession(sessionId: string, updates: UpdateSessionDTO): Promise<Session> {
    const existingSession = await this.getSessionById(sessionId);
    if (!existingSession) {
      throw new Error('Session not found');
    }

    if (existingSession.isRevoked) {
      throw new Error('Cannot update a revoked session');
    }

    // Update last activity if not explicitly provided
    const finalUpdates = {
      ...updates,
      lastActivityAt: updates.lastActivityAt || new Date()
    };

    return this.sessionRepository.update(sessionId, finalUpdates);
  }

  async revokeSession(sessionId: string, reason: string = 'manual_revocation'): Promise<void> {
    const updates: UpdateSessionDTO = {
      isRevoked: true,
      revokedAt: new Date(),
      revocationReason: reason
    };

    await this.updateSession(sessionId, updates);
  }

  async revokeAllUserSessions(userId: string, reason: string = 'user_logout_all'): Promise<void> {
    const sessions = await this.sessionRepository.findByUserId(userId);
    const activeSessions = sessions.filter((session: Session) => isSessionActive(session));

    for (const session of activeSessions) {
      await this.revokeSession(session.id, reason);
    }
  }

  async cleanupExpiredSessions(): Promise<number> {
    const cutoffDate = new Date();
    const sessions = await this.sessionRepository.findExpired(cutoffDate);

    let revokedCount = 0;
    for (const session of sessions) {
      if (!session.isRevoked) {
        await this.revokeSession(session.id, 'auto_cleanup_expired');
        revokedCount++;
      }
    }

    // Also remove very old revoked sessions (older than 30 days)
    const oldCutoff = new Date();
    oldCutoff.setDate(oldCutoff.getDate() - 30);
    await this.sessionRepository.deleteOldRevoked(oldCutoff);

    return revokedCount;
  }

  async validateSession(token: string): Promise<SessionValidationResult> {
    try {
      const session = await this.getSessionByToken(token);
      
      if (!session) {
        return {
          isValid: false,
          error: 'Session not found'
        };
      }

      if (session.isRevoked) {
        return {
          isValid: false,
          error: 'Session revoked',
          session
        };
      }

      if (!isSessionActive(session)) {
        return {
          isValid: false,
          error: 'Session expired',
          session
        };
      }

      // Update last activity
      await this.updateSession(session.id, { lastActivityAt: new Date() });

      return {
        isValid: true,
        session
      };
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async enforceSessionLimit(userId: string): Promise<void> {
    const activeSessions = await this.getSessionsByUserId(userId);
    
    if (activeSessions.length >= SESSION_CONFIG.MAX_CONCURRENT_SESSIONS) {
      // Revoke oldest session
      const sortedSessions = activeSessions.sort((a: Session, b: Session) => 
        a.createdAt.getTime() - b.createdAt.getTime()
      );
      
      const oldestSession = sortedSessions[0];
      await this.revokeSession(oldestSession.id, 'session_limit_exceeded');
    }
  }

  async getActiveSessionsCount(userId: string): Promise<number> {
    const sessions = await this.getSessionsByUserId(userId);
    return sessions.length;
  }

  async getSessionActivity(userId: string, days: number = 30): Promise<{ date: string; count: number }[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const sessions = await this.sessionRepository.findByUserIdAndDate(userId, cutoffDate);
    
    // Group by date
    const activityByDate = new Map<string, number>();
    
    sessions.forEach((session: Session) => {
      const dateKey = session.createdAt.toISOString().split('T')[0];
      activityByDate.set(dateKey, (activityByDate.get(dateKey) || 0) + 1);
    });

    // Convert to array and sort by date
    return Array.from(activityByDate.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}