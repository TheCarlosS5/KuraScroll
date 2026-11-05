import { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import { AuthService, SessionIdentity } from '../services/auth-service.js';

export { SessionIdentity } from '../services/auth-service.js';

declare module 'fastify' {
  interface FastifyRequest {
    sessionIdentity: SessionIdentity | null;
  }
}

export interface AuthPluginOptions {
  authService: AuthService;
  allowedOrigins?: string[];
}

export const authenticationPlugin: FastifyPluginAsync<AuthPluginOptions> = async (
  fastify: FastifyInstance,
  options: AuthPluginOptions
) => {
  const { authService } = options;

  // Register cookie plugin if not already available on the Fastify instance
  if (!(fastify as any).parseCookie) {
    await fastify.register(cookie);
  }

  // Decorate Fastify request with sessionIdentity
  fastify.decorateRequest('sessionIdentity', null);

  const envOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const allowedOriginsSet = new Set<string>([
    ...(options.allowedOrigins || []),
    ...envOrigins,
  ]);

  // Hook 1: Resolve session from cookie
  fastify.addHook('onRequest', async (request: FastifyRequest) => {
    const rawToken = request.cookies?.kura_session;
    if (rawToken) {
      try {
        request.sessionIdentity = await authService.getSession(rawToken);
      } catch (err) {
        request.log.error(err, '[AuthPlugin] Error resolving session cookie');
        request.sessionIdentity = null;
      }
    } else {
      request.sessionIdentity = null;
    }
  });

  // Hook 2: Origin / CSRF validation for mutating requests when cookie session is active
  fastify.addHook('preValidation', async (request: FastifyRequest, reply: FastifyReply) => {
    const mutatingMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
    if (!mutatingMethods.includes(request.method)) {
      return;
    }

    // Only enforce browser origin check if cookie authentication was provided
    const rawToken = request.cookies?.kura_session;
    if (!rawToken) {
      return;
    }

    const origin = request.headers.origin;
    const referer = request.headers.referer;

    // Reject explicitly untrusted cross-site browser fetches
    const secFetchSite = request.headers['sec-fetch-site'];
    if (secFetchSite === 'cross-site') {
      reply.status(403).send({ error: 'Cross-origin request forbidden' });
      return;
    }

    if (origin) {
      let isAllowed = false;
      try {
        const originUrl = new URL(origin);
        const hostHeader = request.headers.host;
        // Check exact match with request Host
        if (hostHeader && originUrl.host.toLowerCase() === hostHeader.toLowerCase()) {
          isAllowed = true;
        }
      } catch {
        isAllowed = false;
      }

      if (!isAllowed && allowedOriginsSet.has(origin)) {
        isAllowed = true;
      }

      // Check localhost/127.0.0.1 default dev patterns
      if (!isAllowed && (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:'))) {
        isAllowed = true;
      }

      if (!isAllowed) {
        request.log.warn({ origin }, '[AuthPlugin] Blocked mutating request from untrusted origin');
        reply.status(403).send({ error: 'CSRF validation failed: untrusted origin' });
        return;
      }
    } else if (referer) {
      let isAllowed = false;
      try {
        const refUrl = new URL(referer);
        const hostHeader = request.headers.host;
        if (hostHeader && refUrl.host.toLowerCase() === hostHeader.toLowerCase()) {
          isAllowed = true;
        }
        if (!isAllowed && (refUrl.origin.startsWith('http://localhost:') || refUrl.origin.startsWith('http://127.0.0.1:'))) {
          isAllowed = true;
        }
        if (!isAllowed && allowedOriginsSet.has(refUrl.origin)) {
          isAllowed = true;
        }
      } catch {
        isAllowed = false;
      }

      if (!isAllowed) {
        reply.status(403).send({ error: 'CSRF validation failed: untrusted referer' });
        return;
      }
    }
  });
};

// Prevent Fastify encapsulation so decorator and hooks apply globally
(authenticationPlugin as any)[Symbol.for('skip-override')] = true;

/**
 * PreHandler: Requires an authenticated user session. Responds 401 if missing.
 */
export async function requireUser(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (!request.sessionIdentity) {
    reply.status(401).send({ error: 'Authentication required' });
    return;
  }
}

/**
 * PreHandler: Requires an authenticated user session with a specific role.
 * Responds 401 if not authenticated, 403 if role mismatch.
 */
export function requireRole(role: 'user' | 'admin') {
  return async function (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    if (!request.sessionIdentity) {
      reply.status(401).send({ error: 'Authentication required' });
      return;
    }
    if (request.sessionIdentity.role !== role) {
      reply.status(403).send({ error: 'Insufficient permissions' });
      return;
    }
  };
}

/**
 * PreHandler: Requires an authenticated user session with verified email.
 * Responds 401 if not authenticated, 403 if email is unverified.
 */
export async function requireVerifiedUser(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (!request.sessionIdentity) {
    reply.status(401).send({ error: 'Authentication required' });
    return;
  }
  if (!request.sessionIdentity.emailVerified) {
    reply.status(403).send({ error: 'Email verification required' });
    return;
  }
}

/**
 * Extracts current SessionIdentity or null.
 */
export function authenticateRequest(request: FastifyRequest): SessionIdentity | null {
  return request.sessionIdentity;
}
