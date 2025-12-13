import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, LoginCredentials, AuthResponse, CreateUserDTO } from '../domain/User';
import { UserRole } from '../domain/User';
import { Session, CreateSessionDTO, TokenPayload, SESSION_CONFIG, calculateExpiryDate } from '../domain/Session';

export interface IAuthService {
  register(userData: CreateUserDTO): Promise<Omit<User, 'passwordHash'>>;
  login(credentials: LoginCredentials, ipAddress?: string, userAgent?: string): Promise<AuthResponse>;
  logout(token: string): Promise<void>;
  validateToken(token: string): Promise<TokenPayload>;
  refreshToken(refreshToken: string): Promise<AuthResponse>;
  changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void>;
}

export class AuthService implements IAuthService {
  private readonly JWT_SECRET: string;
  private readonly JWT_REFRESH_SECRET: string;
  
  constructor(
    private userRepository: any, // Will be replaced with actual repository
    private sessionRepository: any // Will be replaced with actual repository
  ) {
    this.JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
    this.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-super-secret-refresh-key-change-in-production';
  }

  async register(userData: CreateUserDTO): Promise<Omit<User, 'passwordHash'>> {
    // Validate email doesn't exist
    const existingUser = await this.userRepository.findByEmail(userData.email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(userData.password, salt);

    // Create user
    const user = await this.userRepository.create({
      ...userData,
      passwordHash,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Remove password hash from response
    const { passwordHash: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async login(credentials: LoginCredentials, ipAddress?: string, userAgent?: string): Promise<AuthResponse> {
    // Find user by email
    const user = await this.userRepository.findByEmail(credentials.email);
    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Check if user is active
    if (user.status !== 'active') {
      throw new Error('Account is not active');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(credentials.password, user.passwordHash);
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    // Generate tokens
    const token = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    // Create session
    const sessionData: CreateSessionDTO = {
      userId: user.id,
      token,
      refreshToken,
      ipAddress,
      userAgent,
      deviceInfo: this.extractDeviceInfo(userAgent),
      expiresIn: SESSION_CONFIG.ACCESS_TOKEN_EXPIRY
    };

    await this.sessionRepository.create(sessionData);

    // Update last login
    await this.userRepository.update(user.id, { lastLoginAt: new Date() });

    // Remove password hash from response
    const { passwordHash, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      token,
      expiresIn: SESSION_CONFIG.ACCESS_TOKEN_EXPIRY
    };
  }

  async logout(token: string): Promise<void> {
    const session = await this.sessionRepository.findByToken(token);
    if (session) {
      await this.sessionRepository.revoke(session.id, 'user_logout');
    }
  }

  async validateToken(token: string): Promise<TokenPayload> {
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET) as TokenPayload;
      
      // Check if session is still valid
      const session = await this.sessionRepository.findByToken(token);
      if (!session || session.isRevoked || this.isTokenExpired(decoded.exp)) {
        throw new Error('Invalid or expired token');
      }

      return decoded;
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    try {
      const decoded = jwt.verify(refreshToken, this.JWT_REFRESH_SECRET) as TokenPayload;
      
      // Find session by refresh token
      const session = await this.sessionRepository.findByRefreshToken(refreshToken);
      if (!session || session.isRevoked) {
        throw new Error('Invalid refresh token');
      }

      // Get user
      const user = await this.userRepository.findById(decoded.userId);
      if (!user || user.status !== 'active') {
        throw new Error('User not found or inactive');
      }

      // Generate new tokens
      const newToken = this.generateAccessToken(user);
      const newRefreshToken = this.generateRefreshToken(user);

      // Update session with new tokens
      await this.sessionRepository.update(session.id, {
        token: newToken,
        refreshToken: newRefreshToken,
        expiresAt: calculateExpiryDate(SESSION_CONFIG.ACCESS_TOKEN_EXPIRY)
      });

      // Remove password hash from response
      const { passwordHash, ...userWithoutPassword } = user;

      return {
        user: userWithoutPassword,
        token: newToken,
        expiresIn: SESSION_CONFIG.ACCESS_TOKEN_EXPIRY
      };
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Verify old password
    const isValidPassword = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isValidPassword) {
      throw new Error('Current password is incorrect');
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const newPasswordHash = await bcrypt.hash(newPassword, salt);

    // Update password
    await this.userRepository.update(userId, {
      passwordHash: newPasswordHash,
      updatedAt: new Date()
    });
  }

  private generateAccessToken(user: User): string {
    const payload: TokenPayload = {
      userId: user.id,
      role: user.role,
      email: user.email,
      sessionId: '', // Will be filled when session is created
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + SESSION_CONFIG.ACCESS_TOKEN_EXPIRY
    };

    return jwt.sign(payload, this.JWT_SECRET);
  }

  private generateRefreshToken(user: User): string {
    const payload: TokenPayload = {
      userId: user.id,
      role: user.role,
      email: user.email,
      sessionId: '', // Will be filled when session is created
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + SESSION_CONFIG.REFRESH_TOKEN_EXPIRY
    };

    return jwt.sign(payload, this.JWT_REFRESH_SECRET);
  }

  private isTokenExpired(exp: number): boolean {
    return Date.now() >= exp * 1000;
  }

  private extractDeviceInfo(userAgent?: string): string {
    if (!userAgent) return 'Unknown';
    
    // Simple device info extraction
    if (userAgent.includes('Mobile')) return 'Mobile';
    if (userAgent.includes('Tablet')) return 'Tablet';
    return 'Desktop';
  }
}