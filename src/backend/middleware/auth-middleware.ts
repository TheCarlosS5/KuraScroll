import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from '../services/auth-service.js';
import { SafeUser, UserRole } from '../repositories/user-repository.js';
import { getAppConfig } from '../config/app-config.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: SafeUser | null;
  }
}

export const LOCAL_USER: SafeUser = {
  id: 'local_user',
  handle: 'local_user',
  displayName: 'Local User',
  role: 'user',
  emailVerified: true,
  avatarUrl: null,
  bio: null,
  createdAt: '2026-01-01T00:00:00.000Z',
};

export function extractSessionToken(request: FastifyRequest): string | null {
  // 1. From cookie header
  const cookieHeader = request.headers.cookie;
  if (cookieHeader) {
    const cookies = cookieHeader.split(';');
    for (const cookie of cookies) {
      const [name, ...rest] = cookie.trim().split('=');
      if (name === 'kura_session') {
        const val = rest.join('=');
        if (val) return decodeURIComponent(val);
      }
    }
  }

  // 2. From Authorization Bearer header
  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token) return token;
  }

  return null;
}

export function getEffectiveUserId(request: FastifyRequest, fallback: string = 'local_user'): string {
  if (request.user?.id) return request.user.id;
  const headerUserId = request.headers['x-user-id'];
  if (typeof headerUserId === 'string' && headerUserId.trim()) {
    return headerUserId.trim();
  }
  return fallback;
}

export function createAuthMiddleware(authService: AuthService) {
  const attachUser = async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const token = extractSessionToken(request);
    if (!token) {
      request.user = null;
      return;
    }

    try {
      const user = authService.validateSessionToken(token);
      request.user = user;
    } catch {
      request.user = null;
    }
  };

  const attachUserOrLocal = async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const token = extractSessionToken(request);
    if (!token) {
      request.user = LOCAL_USER;
      return;
    }

    try {
      const user = authService.validateSessionToken(token);
      request.user = user || LOCAL_USER;
    } catch {
      request.user = LOCAL_USER;
    }
  };

  const requireAuth = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      reply.code(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Debe iniciar sesión para acceder a este recurso.',
      });
    }
  };

  const requireRole = (...allowedRoles: UserRole[]) => {
    return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      if (!request.user) {
        return reply.code(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Debe iniciar sesión para realizar esta acción.',
        });
      }

      if (!allowedRoles.includes(request.user.role)) {
        return reply.code(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'No cuenta con los permisos necesarios para realizar esta acción.',
        });
      }
    };
  };

  const requireVerified = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const config = getAppConfig();
    if (!config.requireEmailVerification) {
      return;
    }

    if (!request.user) {
      return reply.code(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Debe iniciar sesión.',
      });
    }

    if (!request.user.emailVerified) {
      return reply.code(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Debe verificar su dirección de correo electrónico antes de realizar esta acción.',
        requiresEmailVerification: true,
      });
    }
  };

  return {
    attachUser,
    attachUserOrLocal,
    requireAuth,
    requireRole,
    requireVerified,
  };
}
