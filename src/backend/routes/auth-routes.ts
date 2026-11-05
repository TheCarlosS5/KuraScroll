import { FastifyInstance } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import { AuthService } from '../services/auth-service.js';
import { createAuthMiddleware, extractSessionToken } from '../middleware/auth-middleware.js';
import { createRateLimiter } from '../middleware/rate-limiter.js';
import { getAppConfig } from '../config/app-config.js';

export function registerAuthRoutes(app: FastifyInstance, db: DatabaseInstance): void {
  const authService = new AuthService(db);
  const authMiddleware = createAuthMiddleware(authService);
  const config = getAppConfig();

  // Strict rate limiter for registration and login
  const authRateLimiter = createRateLimiter({
    windowMs: config.rateLimit.authWindowMs,
    maxRequests: config.rateLimit.authMaxAttempts,
    message: 'Demasiados intentos de acceso o registro. Por favor espere unos minutos.',
  });

  // POST /api/v1/auth/register
  app.post(
    '/api/v1/auth/register',
    { preHandler: [authRateLimiter] },
    async (req, reply) => {
      const body = (req.body || {}) as {
        handle?: string;
        email?: string;
        password?: string;
        displayName?: string;
      };

      const ipAddress = req.ip;
      const userAgent = req.headers['user-agent'];

      try {
        const result = await authService.register({
          handle: body.handle || '',
          email: body.email || '',
          password: body.password || '',
          displayName: body.displayName,
          ipAddress,
          userAgent,
        });

        reply.header('Set-Cookie', result.cookieHeader);
        reply.status(201);
        return {
          statusCode: 201,
          user: result.user,
          requiresVerification: result.requiresVerification,
          message: 'Usuario registrado exitosamente.',
        };
      } catch (err: any) {
        reply.status(400);
        return {
          statusCode: 400,
          error: 'Bad Request',
          message: err.message || 'Error al procesar el registro.',
        };
      }
    }
  );

  // POST /api/v1/auth/login
  app.post(
    '/api/v1/auth/login',
    { preHandler: [authRateLimiter] },
    async (req, reply) => {
      const body = (req.body || {}) as {
        login?: string;
        password?: string;
      };

      const ipAddress = req.ip;
      const userAgent = req.headers['user-agent'];

      try {
        const result = await authService.login({
          login: body.login || '',
          password: body.password || '',
          ipAddress,
          userAgent,
        });

        reply.header('Set-Cookie', result.cookieHeader);
        return {
          statusCode: 200,
          user: result.user,
          requiresVerification: result.requiresVerification,
          message: 'Inicio de sesión exitoso.',
        };
      } catch (err: any) {
        reply.status(401);
        return {
          statusCode: 401,
          error: 'Unauthorized',
          message: err.message || 'Credenciales inválidas.',
        };
      }
    }
  );

  // POST /api/v1/auth/logout
  app.post(
    '/api/v1/auth/logout',
    async (req, reply) => {
      const token = extractSessionToken(req);
      if (token) {
        authService.logout(token);
      }
      reply.header('Set-Cookie', authService.buildClearCookie());
      return {
        statusCode: 200,
        ok: true,
        message: 'Sesión cerrada correctamente.',
      };
    }
  );

  // GET /api/v1/auth/me
  app.get(
    '/api/v1/auth/me',
    { preHandler: [authMiddleware.attachUser] },
    async (req) => {
      return {
        user: req.user || null,
        authenticated: Boolean(req.user),
      };
    }
  );

  // POST /api/v1/auth/verify-email
  app.post(
    '/api/v1/auth/verify-email',
    { preHandler: [authMiddleware.attachUser, authMiddleware.requireAuth] },
    async (req, reply) => {
      const body = (req.body || {}) as { code?: string };
      const userId = req.user!.id;

      try {
        await authService.verifyEmailCode(userId, body.code || '');
        return {
          statusCode: 200,
          verified: true,
          message: 'Correo electrónico verificado exitosamente.',
        };
      } catch (err: any) {
        reply.status(400);
        return {
          statusCode: 400,
          error: 'Bad Request',
          message: err.message || 'Error al verificar el código.',
        };
      }
    }
  );

  // POST /api/v1/auth/resend-code
  app.post(
    '/api/v1/auth/resend-code',
    { preHandler: [authMiddleware.attachUser, authMiddleware.requireAuth, authRateLimiter] },
    async (req, reply) => {
      const userId = req.user!.id;
      try {
        await authService.resendVerification(userId);
        return {
          statusCode: 200,
          sent: true,
          message: 'Se ha enviado un nuevo código a su correo electrónico.',
        };
      } catch (err: any) {
        reply.status(400);
        return {
          statusCode: 400,
          error: 'Bad Request',
          message: err.message || 'Error al reenviar el código.',
        };
      }
    }
  );
}
