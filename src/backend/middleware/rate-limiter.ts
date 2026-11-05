import { FastifyRequest, FastifyReply } from 'fastify';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

export interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (request: FastifyRequest) => string;
  message?: string;
}

export function createRateLimiter(options: RateLimiterOptions) {
  const {
    windowMs,
    maxRequests,
    keyGenerator = (req) => `${req.ip || 'unknown'}:${req.routeOptions?.url || req.url}`,
    message = 'Demasiadas solicitudes. Por favor intente más tarde.',
  } = options;

  const hits = new Map<string, RateLimitRecord>();

  // Periodic cleanup of expired records every minute
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of hits.entries()) {
      if (now > record.resetAt) {
        hits.delete(key);
      }
    }
  }, 60_000);

  if (typeof cleanupInterval.unref === 'function') {
    cleanupInterval.unref();
  }

  return async function rateLimitHook(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const now = Date.now();
    const key = keyGenerator(request);
    let record = hits.get(key);

    if (!record || now > record.resetAt) {
      record = {
        count: 1,
        resetAt: now + windowMs,
      };
      hits.set(key, record);
    } else {
      record.count += 1;
    }

    const remaining = Math.max(0, maxRequests - record.count);
    const retryAfterSeconds = Math.ceil((record.resetAt - now) / 1000);

    reply.header('X-RateLimit-Limit', maxRequests);
    reply.header('X-RateLimit-Remaining', remaining);
    reply.header('X-RateLimit-Reset', Math.ceil(record.resetAt / 1000));

    if (record.count > maxRequests) {
      reply.header('Retry-After', retryAfterSeconds);
      reply.code(429).send({
        statusCode: 429,
        error: 'Too Many Requests',
        message,
        retryAfter: retryAfterSeconds,
      });
    }
  };
}
