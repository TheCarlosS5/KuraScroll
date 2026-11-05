import crypto from 'node:crypto';
import { DatabaseInstance } from '../db/database.js';
import { UserRepository, SafeUser } from '../repositories/user-repository.js';
import { SessionRepository, SessionRecord } from '../repositories/session-repository.js';
import { VerificationCodeRepository } from '../repositories/verification-code-repository.js';
import { EmailService } from './email-service.js';
import { getAppConfig } from '../config/app-config.js';

export interface RegisterInput {
  handle: string;
  email: string;
  password: string;
  displayName?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface LoginInput {
  login: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuthResult {
  user: SafeUser;
  sessionToken: string;
  cookieHeader: string;
  requiresVerification: boolean;
}

export class AuthService {
  private userRepo: UserRepository;
  private sessionRepo: SessionRepository;
  private codeRepo: VerificationCodeRepository;
  private emailService: EmailService;

  constructor(private db: DatabaseInstance) {
    this.userRepo = new UserRepository(db);
    this.sessionRepo = new SessionRepository(db);
    this.codeRepo = new VerificationCodeRepository(db);
    this.emailService = new EmailService();
  }

  // --- Password Hashing via Node.js native scrypt ---
  hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const derivedKey = crypto.scryptSync(password, salt, 64);
    return `scrypt:${salt}:${derivedKey.toString('hex')}`;
  }

  verifyPassword(password: string, storedHash: string): boolean {
    const parts = storedHash.split(':');
    if (parts.length !== 3 || parts[0] !== 'scrypt') {
      return false;
    }
    const salt = parts[1];
    const key = Buffer.from(parts[2], 'hex');
    const derivedKey = crypto.scryptSync(password, salt, 64);
    return key.length === derivedKey.length && crypto.timingSafeEqual(key, derivedKey);
  }

  // --- Session Token Management ---
  hashSessionToken(token: string): string {
    const config = getAppConfig();
    return crypto.createHash('sha256').update(token + config.sessionSecret).digest('hex');
  }

  hashVerificationCode(code: string): string {
    const config = getAppConfig();
    return crypto.createHash('sha256').update(code + config.sessionSecret).digest('hex');
  }

  buildSessionCookie(token: string, maxAgeMs: number): string {
    const config = getAppConfig();
    const parts = [
      `kura_session=${token}`,
      `Path=/`,
      `Max-Age=${Math.floor(maxAgeMs / 1000)}`,
      `HttpOnly`,
      `SameSite=Lax`,
    ];
    if (config.cookieSecure) {
      parts.push('Secure');
    }
    return parts.join('; ');
  }

  buildClearCookie(): string {
    const config = getAppConfig();
    const parts = [
      `kura_session=`,
      `Path=/`,
      `Max-Age=0`,
      `HttpOnly`,
      `SameSite=Lax`,
    ];
    if (config.cookieSecure) {
      parts.push('Secure');
    }
    return parts.join('; ');
  }

  // --- User Registration ---
  async register(input: RegisterInput): Promise<AuthResult> {
    const config = getAppConfig();
    const handle = (input.handle || '').trim().toLowerCase();
    const email = (input.email || '').trim().toLowerCase();
    const displayName = (input.displayName || handle).trim();
    const password = input.password || '';

    // Validation
    const handleRegex = /^[a-zA-Z0-9_]{3,30}$/;
    if (!handleRegex.test(handle)) {
      throw new Error('El nombre de usuario debe tener entre 3 y 30 caracteres alfanuméricos o guion bajo.');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('El formato del correo electrónico no es válido.');
    }

    if (password.length < 8 || password.length > 128) {
      throw new Error('La contraseña debe tener entre 8 y 128 caracteres.');
    }

    if (this.userRepo.findByHandle(handle)) {
      throw new Error(`El nombre de usuario @${handle} ya está en uso.`);
    }

    if (this.userRepo.findByEmail(email)) {
      throw new Error('Ya existe una cuenta registrada con este correo electrónico.');
    }

    const userId = crypto.randomUUID();
    const passwordHash = this.hashPassword(password);
    const requiresVerification = config.requireEmailVerification;

    const safeUser = this.userRepo.createUser({
      id: userId,
      handle,
      email,
      displayName,
      passwordHash,
      role: 'user',
      emailVerified: !requiresVerification,
    });

    if (requiresVerification) {
      try {
        await this.createAndSendVerificationCode(userId, email, handle);
      } catch (error) {
        // Avoid leaving an account that cannot receive its first verification code.
        this.db.prepare('DELETE FROM users WHERE id = ?').run(userId);
        throw error;
      }
    }

    // Create session
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashSessionToken(sessionToken);
    const expiresAt = new Date(Date.now() + config.sessionMaxAgeMs).toISOString();

    this.sessionRepo.createSession({
      id: crypto.randomUUID(),
      tokenHash,
      userId,
      expiresAt,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    const cookieHeader = this.buildSessionCookie(sessionToken, config.sessionMaxAgeMs);

    return {
      user: safeUser,
      sessionToken,
      cookieHeader,
      requiresVerification,
    };
  }

  // --- User Login ---
  async login(input: LoginInput): Promise<AuthResult> {
    const config = getAppConfig();
    const login = (input.login || '').trim();
    const password = input.password || '';

    if (!login || !password) {
      throw new Error('Ingrese usuario/correo y contraseña.');
    }
    if (password.length > 128) {
      throw new Error('Credenciales incorrectas.');
    }

    const user = this.userRepo.findByLogin(login);
    if (!user) {
      throw new Error('Credenciales incorrectas.');
    }

    const isValidPassword = this.verifyPassword(password, user.password_hash);
    if (!isValidPassword) {
      throw new Error('Credenciales incorrectas.');
    }

    // Create session
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashSessionToken(sessionToken);
    const expiresAt = new Date(Date.now() + config.sessionMaxAgeMs).toISOString();

    this.sessionRepo.createSession({
      id: crypto.randomUUID(),
      tokenHash,
      userId: user.id,
      expiresAt,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    const cookieHeader = this.buildSessionCookie(sessionToken, config.sessionMaxAgeMs);
    const safeUser = this.userRepo.toSafeUser(user);

    return {
      user: safeUser,
      sessionToken,
      cookieHeader,
      requiresVerification: config.requireEmailVerification && !safeUser.emailVerified,
    };
  }

  // --- Verification Code Flow ---
  async createAndSendVerificationCode(userId: string, email: string, handle: string): Promise<void> {
    const code = crypto.randomInt(100000, 999999).toString();
    const codeHash = this.hashVerificationCode(code);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 mins

    this.codeRepo.createCode(userId, codeHash, expiresAt);
    const delivery = await this.emailService.sendVerificationCode({
      toEmail: email,
      handle,
      code,
    });
    if (!delivery.success) {
      throw new Error(delivery.error || 'No se pudo enviar el código de verificación.');
    }
  }

  async verifyEmailCode(userId: string, code: string): Promise<boolean> {
    const cleanCode = (code || '').trim();
    if (cleanCode.length !== 6) {
      throw new Error('El código debe tener 6 dígitos.');
    }

    const record = this.codeRepo.findActiveCode(userId);
    if (!record) {
      throw new Error('No hay ningún código de verificación activo o ya ha expirado.');
    }

    if (record.attempts >= 5) {
      this.codeRepo.markUsed(record.id);
      throw new Error('Demasiados intentos fallidos. Solicite un nuevo código.');
    }

    const expectedHash = this.hashVerificationCode(cleanCode);
    const expectedBuf = Buffer.from(expectedHash, 'hex');
    const actualBuf = Buffer.from(record.code_hash, 'hex');

    const matches = expectedBuf.length === actualBuf.length && crypto.timingSafeEqual(expectedBuf, actualBuf);

    if (!matches) {
      this.codeRepo.incrementAttempts(record.id);
      throw new Error('El código ingresado es incorrecto.');
    }

    this.codeRepo.markUsed(record.id);
    this.userRepo.setEmailVerified(userId, true);
    return true;
  }

  async resendVerification(userId: string): Promise<void> {
    const user = this.userRepo.findById(userId);
    if (!user) {
      throw new Error('Usuario no encontrado.');
    }
    if (user.email_verified) {
      throw new Error('La cuenta ya se encuentra verificada.');
    }
    await this.createAndSendVerificationCode(user.id, user.email, user.handle);
  }

  // --- Logout ---
  logout(token: string): void {
    if (!token) return;
    const tokenHash = this.hashSessionToken(token);
    this.sessionRepo.revokeSession(tokenHash);
  }

  // --- Session Validation ---
  validateSessionToken(token: string): SafeUser | null {
    if (!token) return null;
    const tokenHash = this.hashSessionToken(token);
    const result = this.sessionRepo.findValidSessionWithUser(tokenHash);
    return result ? result.user : null;
  }
}
