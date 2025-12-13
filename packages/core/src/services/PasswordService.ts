import bcrypt from 'bcryptjs';

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  maxAgeDays?: number; // Password expiration in days
  preventReuse: number; // Number of previous passwords to remember
}

export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  maxAgeDays: 90, // Change password every 90 days
  preventReuse: 5 // Remember last 5 passwords
};

export class PasswordService {
  private readonly saltRounds: number = 10;
  
  constructor(private policy: PasswordPolicy = DEFAULT_PASSWORD_POLICY) {}

  /**
   * Hash a password using bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(this.saltRounds);
    return bcrypt.hash(password, salt);
  }

  /**
   * Verify if a password matches a hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Validate password against policy
   */
  validatePassword(password: string): PasswordValidationResult {
    const errors: string[] = [];

    // Check minimum length
    if (password.length < this.policy.minLength) {
      errors.push(`Password must be at least ${this.policy.minLength} characters long`);
    }

    // Check uppercase requirement
    if (this.policy.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    // Check lowercase requirement
    if (this.policy.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    // Check numbers requirement
    if (this.policy.requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    // Check special characters requirement
    if (this.policy.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    // Check for common passwords (simplified check)
    const commonPasswords = ['password', '123456', 'qwerty', 'admin', 'welcome'];
    if (commonPasswords.includes(password.toLowerCase())) {
      errors.push('Password is too common. Please choose a stronger password');
    }

    // Check for sequential characters
    if (this.hasSequentialChars(password, 3)) {
      errors.push('Password contains sequential characters');
    }

    // Check for repeated characters
    if (this.hasRepeatedChars(password, 3)) {
      errors.push('Password contains repeated characters');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate a random password
   */
  generateRandomPassword(length: number = 12): string {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const specialChars = '!@#$%^&*()-_=+[]{}|;:,.<>?';

    let charset = '';
    if (this.policy.requireUppercase) charset += uppercase;
    if (this.policy.requireLowercase) charset += lowercase;
    if (this.policy.requireNumbers) charset += numbers;
    if (this.policy.requireSpecialChars) charset += specialChars;

    // Ensure at least one character from each required set
    let password = '';
    if (this.policy.requireUppercase) password += this.getRandomChar(uppercase);
    if (this.policy.requireLowercase) password += this.getRandomChar(lowercase);
    if (this.policy.requireNumbers) password += this.getRandomChar(numbers);
    if (this.policy.requireSpecialChars) password += this.getRandomChar(specialChars);

    // Fill the rest randomly
    for (let i = password.length; i < length; i++) {
      password += this.getRandomChar(charset);
    }

    // Shuffle the password
    return this.shuffleString(password);
  }

  /**
   * Check if password needs to be changed based on age
   */
  isPasswordExpired(lastChangedDate: Date): boolean {
    if (!this.policy.maxAgeDays) return false;
    
    const expirationDate = new Date(lastChangedDate);
    expirationDate.setDate(expirationDate.getDate() + this.policy.maxAgeDays);
    
    return new Date() > expirationDate;
  }

  /**
   * Get days until password expires
   */
  getDaysUntilExpiration(lastChangedDate: Date): number {
    if (!this.policy.maxAgeDays) return Infinity;
    
    const expirationDate = new Date(lastChangedDate);
    expirationDate.setDate(expirationDate.getDate() + this.policy.maxAgeDays);
    
    const now = new Date();
    const diffTime = expirationDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Check if new password is in history
   */
  isPasswordInHistory(newPassword: string, passwordHistory: string[]): Promise<boolean> {
    return Promise.all(
      passwordHistory.map(oldHash => this.verifyPassword(newPassword, oldHash))
    ).then(results => results.some(match => match));
  }

  private hasSequentialChars(str: string, length: number): boolean {
    for (let i = 0; i <= str.length - length; i++) {
      const segment = str.substr(i, length);
      if (this.isSequential(segment)) {
        return true;
      }
    }
    return false;
  }

  private hasRepeatedChars(str: string, length: number): boolean {
    for (let i = 0; i <= str.length - length; i++) {
      const segment = str.substr(i, length);
      if (new Set(segment).size === 1) {
        return true;
      }
    }
    return false;
  }

  private isSequential(str: string): boolean {
    // Check for sequential numbers (123, 456, etc.)
    if (/^\d+$/.test(str)) {
      for (let i = 1; i < str.length; i++) {
        if (parseInt(str[i]) !== parseInt(str[i-1]) + 1) {
          return false;
        }
      }
      return true;
    }

    // Check for sequential letters (abc, def, etc.)
    if (/^[a-zA-Z]+$/.test(str)) {
      const lowerStr = str.toLowerCase();
      for (let i = 1; i < lowerStr.length; i++) {
        if (lowerStr.charCodeAt(i) !== lowerStr.charCodeAt(i-1) + 1) {
          return false;
        }
      }
      return true;
    }

    return false;
  }

  private getRandomChar(charset: string): string {
    const randomIndex = Math.floor(Math.random() * charset.length);
    return charset[randomIndex];
  }

  private shuffleString(str: string): string {
    const array = str.split('');
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array.join('');
  }
}