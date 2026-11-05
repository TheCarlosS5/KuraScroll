import crypto from 'node:crypto';
import { AuthRepository, UserRecord } from '../repositories/auth-repository.js';
import { EmailService } from './email-service.js';

export interface RegisterInput {
  email: string;
  password: string;
  handle: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface SessionIdentity {
  userId: string;
  handle: string;
  role: 'user' | 'admin';
  emailVerified: boolean;
}

export interface AuthResult {
  identity: SessionIdentity;
  rawToken: string;
  expiresAt: string;
}

export interface AuthServiceOptions {
  appBaseUrl?: string;
  sessionDurationDays?: number;
}

export class AuthService {
  private appBaseUrl: string;
  private sessionDurationDays: number;

  constructor(
    private authRepo: AuthRepository,
    private emailService: EmailService,
    options?: AuthServiceOptions
  ) {
    this.appBaseUrl = options?.appBaseUrl || process.env.APP_BASE_URL || 'http://localhost:5173';
    this.sessionDurationDays = options?.sessionDurationDays || 30;
  }

  // --- Hashing and Cryptographic Helpers ---

  public static hashPassword(password: string): string {
    const salt = crypto.randomBytes(16);
    const derivedKey = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
    return `${salt.toString('hex')}:${derivedKey.toString('hex')}`;
  }

  public static verifyPassword(password: string, storedHash: string): boolean {
    const parts = storedHash.split(':');
    if (parts.length !== 2) return false;
    const [saltHex, keyHex] = parts;
    const salt = Buffer.from(saltHex, 'hex');
    const expectedKey = Buffer.from(keyHex, 'hex');

    const derivedKey = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
    if (derivedKey.length !== expectedKey.length) {
      return false;
    }
    return crypto.timingSafeEqual(derivedKey, expectedKey);
  }

  public static generateRawToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  public static hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private validateEmail(email: string): void {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email) || email.length > 254) {
      const err: any = new Error('Dirección de correo electrónico inválida');
      err.statusCode = 400;
      throw err;
    }
  }

  private validateHandle(handle: string): void {
    const handleRegex = /^[a-zA-Z0-9_-]{3,30}$/;
    if (!handle || !handleRegex.test(handle)) {
      const err: any = new Error(
        'El nombre de usuario debe tener entre 3 y 30 caracteres alfanuméricos, guiones o guiones bajos'
      );
      err.statusCode = 400;
      throw err;
    }
  }

  private validatePassword(password: string): void {
    if (!password || password.length < 8 || password.length > 128) {
      const err: any = new Error('La contraseña debe tener entre 8 y 128 caracteres');
      err.statusCode = 400;
      throw err;
    }
  }

  private buildSessionIdentity(user: UserRecord): SessionIdentity {
    return {
      userId: user.id,
      handle: user.handle,
      role: user.role,
      emailVerified: user.emailVerifiedAt !== null,
    };
  }

  // --- Auth Operations ---

  public async register(input: RegisterInput): Promise<AuthResult> {
    const normalizedEmail = this.normalizeEmail(input.email);
    this.validateEmail(normalizedEmail);
    this.validateHandle(input.handle);
    this.validatePassword(input.password);

    // Check unique constraints
    const existingEmail = this.authRepo.findUserByEmail(normalizedEmail);
    if (existingEmail) {
      const err: any = new Error('El correo electrónico o nombre de usuario ya está registrado');
      err.statusCode = 409;
      throw err;
    }

    const existingHandle = this.authRepo.findUserByHandle(input.handle);
    if (existingHandle) {
      const err: any = new Error('El correo electrónico o nombre de usuario ya está registrado');
      err.statusCode = 409;
      throw err;
    }

    const userId = crypto.randomUUID();
    const passwordHash = AuthService.hashPassword(input.password);

    const user = this.authRepo.createUser({
      id: userId,
      emailNormalized: normalizedEmail,
      handle: input.handle,
      passwordHash,
      role: 'user',
    });

    // Create email verification action token (valid for 24h)
    const rawVerifyToken = AuthService.generateRawToken();
    const verifyTokenHash = AuthService.hashToken(rawVerifyToken);
    const verifyExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    this.authRepo.createActionToken({
      tokenHash: verifyTokenHash,
      userId: user.id,
      actionType: 'verify_email',
      expiresAt: verifyExpiresAt,
    });

    // Send verification email
    const verifyUrl = `${this.appBaseUrl.replace(/\/$/, '')}/api/v1/auth/verify-email?token=${rawVerifyToken}`;
    try {
      await this.emailService.sendVerificationEmail(user.emailNormalized, user.handle, verifyUrl);
    } catch (mailErr) {
      console.error('[AuthService] Failed to send verification email:', mailErr);
    }

    // Create session (valid for 30 days)
    const rawSessionToken = AuthService.generateRawToken();
    const sessionTokenHash = AuthService.hashToken(rawSessionToken);
    const sessionExpiresAt = new Date(
      Date.now() + this.sessionDurationDays * 24 * 60 * 60 * 1000
    ).toISOString();

    this.authRepo.createSession({
      tokenHash: sessionTokenHash,
      userId: user.id,
      expiresAt: sessionExpiresAt,
    });

    return {
      identity: this.buildSessionIdentity(user),
      rawToken: rawSessionToken,
      expiresAt: sessionExpiresAt,
    };
  }

  public async login(input: LoginInput): Promise<AuthResult> {
    const normalizedEmail = this.normalizeEmail(input.email);
    const user = this.authRepo.findUserByEmail(normalizedEmail);

    if (!user) {
      // Run dummy verification to mitigate side-channel timing attacks
      AuthService.verifyPassword('dummy_password_timing_pad', '00000000000000000000000000000000:00000000000000000000000000000000');
      const err: any = new Error('Credenciales incorrectas');
      err.statusCode = 401;
      throw err;
    }

    if (user.disabledAt) {
      const err: any = new Error('Esta cuenta ha sido desactivada');
      err.statusCode = 403;
      throw err;
    }

    const isValid = AuthService.verifyPassword(input.password, user.passwordHash);
    if (!isValid) {
      const err: any = new Error('Credenciales incorrectas');
      err.statusCode = 401;
      throw err;
    }

    // Create session
    const rawSessionToken = AuthService.generateRawToken();
    const sessionTokenHash = AuthService.hashToken(rawSessionToken);
    const sessionExpiresAt = new Date(
      Date.now() + this.sessionDurationDays * 24 * 60 * 60 * 1000
    ).toISOString();

    this.authRepo.createSession({
      tokenHash: sessionTokenHash,
      userId: user.id,
      expiresAt: sessionExpiresAt,
    });

    return {
      identity: this.buildSessionIdentity(user),
      rawToken: rawSessionToken,
      expiresAt: sessionExpiresAt,
    };
  }

  public async logout(rawToken: string): Promise<void> {
    if (!rawToken) return;
    const tokenHash = AuthService.hashToken(rawToken);
    this.authRepo.revokeSession(tokenHash);
  }

  public async verifyEmail(rawActionToken: string): Promise<boolean> {
    if (!rawActionToken) return false;
    const tokenHash = AuthService.hashToken(rawActionToken);
    const tokenRecord = this.authRepo.findActionTokenByHash(tokenHash);

    if (!tokenRecord || tokenRecord.actionType !== 'verify_email') {
      return false;
    }

    if (tokenRecord.consumedAt) {
      return false;
    }

    if (new Date(tokenRecord.expiresAt).getTime() < Date.now()) {
      return false;
    }

    const consumed = this.authRepo.consumeActionToken(tokenHash);
    if (!consumed) return false;

    return this.authRepo.verifyUserEmail(tokenRecord.userId);
  }

  public async requestPasswordReset(email: string): Promise<void> {
    const normalizedEmail = this.normalizeEmail(email);
    const user = this.authRepo.findUserByEmail(normalizedEmail);

    // Generic response: never leak existence of email address
    if (!user || user.disabledAt) {
      return;
    }

    const rawActionToken = AuthService.generateRawToken();
    const tokenHash = AuthService.hashToken(rawActionToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    this.authRepo.createActionToken({
      tokenHash,
      userId: user.id,
      actionType: 'reset_password',
      expiresAt,
    });

    const resetUrl = `${this.appBaseUrl.replace(/\/$/, '')}/reset-password?token=${rawActionToken}`;
    try {
      await this.emailService.sendPasswordResetEmail(user.emailNormalized, user.handle, resetUrl);
    } catch (mailErr) {
      console.error('[AuthService] Failed to send password reset email:', mailErr);
    }
  }

  public async resetPassword(rawActionToken: string, newPassword: string): Promise<boolean> {
    if (!rawActionToken) return false;
    this.validatePassword(newPassword);

    const tokenHash = AuthService.hashToken(rawActionToken);
    const tokenRecord = this.authRepo.findActionTokenByHash(tokenHash);

    if (!tokenRecord || tokenRecord.actionType !== 'reset_password') {
      return false;
    }

    if (tokenRecord.consumedAt) {
      return false;
    }

    if (new Date(tokenRecord.expiresAt).getTime() < Date.now()) {
      return false;
    }

    const newPasswordHash = AuthService.hashPassword(newPassword);
    const updated = this.authRepo.updatePassword(tokenRecord.userId, newPasswordHash);
    if (!updated) return false;

    this.authRepo.consumeActionToken(tokenHash);
    // Invalidate all existing sessions for this user for security
    this.authRepo.revokeAllUserSessions(tokenRecord.userId);

    return true;
  }

  public async getSession(rawToken: string): Promise<SessionIdentity | null> {
    if (!rawToken || typeof rawToken !== 'string') return null;

    const tokenHash = AuthService.hashToken(rawToken);
    const session = this.authRepo.findSessionByTokenHash(tokenHash);

    if (!session || session.revokedAt) {
      return null;
    }

    if (new Date(session.expiresAt).getTime() < Date.now()) {
      return null;
    }

    const user = this.authRepo.findUserById(session.userId);
    if (!user || user.disabledAt) {
      return null;
    }

    return this.buildSessionIdentity(user);
  }
}
