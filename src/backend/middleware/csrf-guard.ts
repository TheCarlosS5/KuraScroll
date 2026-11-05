import { FastifyRequest, FastifyReply } from 'fastify';
import { getAppConfig } from '../config/app-config.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export async function csrfGuard(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (SAFE_METHODS.has(request.method)) {
    return;
  }

  // API Token requests (machine-to-machine) are exempt from CSRF checks
  const authHeader = request.headers.authorization;
  const apiTokenHeader = request.headers['x-api-token'];
  const config = getAppConfig();
  if (config.apiToken && (apiTokenHeader === config.apiToken || authHeader === `Bearer ${config.apiToken}`)) {
    return;
  }

  // SPA requests should send X-Requested-With or Sec-Fetch-Site/Origin checks
  const requestedWith = request.headers['x-requested-with'];
  const origin = request.headers.origin;
  const referer = request.headers.referer;

  if (requestedWith) {
    return;
  }

  if (origin) {
    const isAllowedOrigin = config.corsOrigins.some((allowed) => {
      try {
        return new URL(allowed).origin === new URL(origin).origin;
      } catch {
        return allowed === origin;
      }
    });

    if (isAllowedOrigin) {
      return;
    }
  }

  if (referer) {
    const isAllowedReferer = config.corsOrigins.some((allowed) => {
      try {
        return new URL(referer).origin === new URL(allowed).origin;
      } catch {
        return false;
      }
    });

    if (isAllowedReferer) {
      return;
    }
  }

  reply.code(403).send({
    statusCode: 403,
    error: 'Forbidden',
    message: 'CSRF protection: Petición rechazada. Incluya la cabecera X-Requested-With o envíe desde un origen permitido.',
  });
}
