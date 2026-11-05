import path from 'node:path';
import crypto from 'node:crypto';

export interface AppConfig {
  port: number;
  host: string;
  publicPlatform: boolean;
  storageRoot: string;
  incomingRoot: string;
  apiToken?: string;
  sessionSecret: string;
  sessionMaxAgeMs: number;
  cookieSecure: boolean;
  corsOrigins: string[];
  requireEmailVerification: boolean;
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
    user?: string;
    pass?: string;
    from: string;
  };
  upload: {
    maxFileSizeMb: number;
    maxPagesPerChapter: number;
    userQuotaGb: number;
  };
  rateLimit: {
    authWindowMs: number;
    authMaxAttempts: number;
    apiWindowMs: number;
    apiMaxRequests: number;
  };
}

let cachedConfig: AppConfig | null = null;

export function getAppConfig(): AppConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const port = Number.parseInt(process.env.PORT || '4000', 10);
  const host = process.env.HOST || '0.0.0.0';
  const storageRoot = process.env.STORAGE_ROOT
    ? path.resolve(process.env.STORAGE_ROOT)
    : path.resolve('./data/storage');
  const incomingRoot = process.env.INCOMING_DIR
    ? path.resolve(process.env.INCOMING_DIR)
    : path.resolve(storageRoot, 'incoming');

  const publicPlatform = process.env.PUBLIC_PLATFORM_MODE === 'true';
  const configuredSessionSecret = process.env.SESSION_SECRET?.trim();
  if (process.env.NODE_ENV === 'production' && (!configuredSessionSecret || configuredSessionSecret.length < 32)) {
    throw new Error('SESSION_SECRET must contain at least 32 characters in production.');
  }
  const sessionSecret = configuredSessionSecret || crypto.randomBytes(32).toString('hex');

  const cookieSecure = process.env.COOKIE_SECURE === 'true' ||
    (process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== 'false');

  const configuredOrigins = (process.env.KURA_CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  const corsOrigins = configuredOrigins.length > 0
    ? configuredOrigins
    : ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4000', 'http://127.0.0.1:4000'];

  const requireEmailVerification = process.env.REQUIRE_EMAIL_VERIFICATION === 'true';
  const maxFileSizeMb = Number.parseInt(process.env.MAX_FILE_SIZE_MB || '25', 10);
  const maxPagesPerChapter = Number.parseInt(process.env.MAX_PAGES_PER_CHAPTER || '250', 10);
  const userQuotaGb = Number.parseInt(process.env.USER_QUOTA_GB || '5', 10);

  if (!Number.isInteger(maxFileSizeMb) || maxFileSizeMb < 1 || maxFileSizeMb > 100) {
    throw new Error('MAX_FILE_SIZE_MB must be an integer between 1 and 100.');
  }
  if (!Number.isInteger(maxPagesPerChapter) || maxPagesPerChapter < 1 || maxPagesPerChapter > 1000) {
    throw new Error('MAX_PAGES_PER_CHAPTER must be an integer between 1 and 1000.');
  }
  if (!Number.isInteger(userQuotaGb) || userQuotaGb < 1 || userQuotaGb > 1000) {
    throw new Error('USER_QUOTA_GB must be an integer between 1 and 1000.');
  }

  let smtp: AppConfig['smtp'] = undefined;
  if (process.env.SMTP_HOST) {
    const smtpPort = Number.parseInt(process.env.SMTP_PORT || '587', 10);
    if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535) {
      throw new Error('SMTP_PORT must be an integer between 1 and 65535.');
    }
    smtp = {
      host: process.env.SMTP_HOST,
      port: smtpPort,
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
      from: process.env.SMTP_FROM || 'no-reply@kura-scroll.local',
    };
  }

  if (requireEmailVerification && !smtp) {
    throw new Error('REQUIRE_EMAIL_VERIFICATION=true requires SMTP_HOST to be configured.');
  }
  if (publicPlatform && process.env.NODE_ENV === 'production' && !cookieSecure) {
    throw new Error('COOKIE_SECURE must be true for the public platform in production.');
  }

  cachedConfig = {
    port,
    host,
    publicPlatform,
    storageRoot,
    incomingRoot,
    apiToken: process.env.API_TOKEN,
    sessionSecret,
    sessionMaxAgeMs: 30 * 24 * 60 * 60 * 1000, // 30 days
    cookieSecure,
    corsOrigins,
    requireEmailVerification,
    smtp,
    upload: {
      maxFileSizeMb,
      maxPagesPerChapter,
      userQuotaGb,
    },
    rateLimit: {
      authWindowMs: 15 * 60 * 1000, // 15 minutes
      authMaxAttempts: 10,
      apiWindowMs: 60 * 1000, // 1 minute
      apiMaxRequests: 200,
    },
  };

  return cachedConfig;
}
