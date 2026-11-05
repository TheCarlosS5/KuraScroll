import { FastifyReply, FastifyRequest } from 'fastify';

const MAX_CONCURRENT_UPLOAD_REQUESTS = 2;
let activeUploadRequests = 0;

/** Bound request-body buffers and image processing pressure on the single-instance VPS profile. */
export async function uploadConcurrencyGuard(
  _request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (activeUploadRequests >= MAX_CONCURRENT_UPLOAD_REQUESTS) {
    reply.header('Retry-After', '5').code(429).send({
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'El servidor alcanzó el límite temporal de cargas. Reintenta en unos segundos.',
    });
    return;
  }

  activeUploadRequests += 1;
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    activeUploadRequests = Math.max(0, activeUploadRequests - 1);
  };

  // Release on either normal response completion or client disconnect.
  reply.raw.once('finish', release);
  reply.raw.once('close', release);
}
