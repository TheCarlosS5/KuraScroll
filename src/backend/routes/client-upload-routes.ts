import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Readable } from 'node:stream';
import crypto from 'node:crypto';
import { DatabaseInstance } from '../db/database.js';
import {
  ClientProcessedUploadService,
  UploadServiceError,
  CreateUploadInput,
  ChapterManifest,
  UploadPageMetadata,
  MAX_PAGE_BYTES,
} from '../services/client-processed-upload-service.js';
import { AuthService, SessionIdentity } from '../services/auth-service.js';

export interface ClientUploadRoutesOptions {
  uploadService?: ClientProcessedUploadService;
  authService?: AuthService;
  db?: DatabaseInstance;
  storageRoot?: string;
}

/**
 * Resolves session identity from request (Fastify decorator, cookies, or Bearer header).
 */
export async function getSessionFromRequest(
  request: FastifyRequest,
  authService?: AuthService,
  db?: DatabaseInstance
): Promise<SessionIdentity | null> {
  // 1. Attached by upstream authentication plugin
  if (request.sessionIdentity) {
    return request.sessionIdentity;
  }

  // 2. Extract token from cookie or Authorization header
  let rawToken: string | null = null;
  const cookieToken = request.cookies?.kura_session || request.cookies?.ks_session;
  if (cookieToken) {
    rawToken = cookieToken;
  } else if (request.headers.cookie) {
    const match = request.headers.cookie.match(/(?:^|;\s*)(?:kura_session|ks_session)=([^;]+)/);
    if (match) {
      rawToken = decodeURIComponent(match[1]);
    }
  }

  if (!rawToken && request.headers.authorization) {
    const parts = request.headers.authorization.split(' ');
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
      rawToken = parts[1];
    }
  }

  if (!rawToken) {
    return null;
  }

  // 3. Resolve with AuthService if available
  if (authService) {
    try {
      const session = await authService.getSession(rawToken);
      if (session) return session;
    } catch {}
  }

  // 4. Resolve directly with SQLite tables if DB is provided
  if (db) {
    try {
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const row = db.prepare(`
        SELECT s.user_id, s.expires_at, s.revoked_at,
               u.handle, u.role, u.email_verified_at, u.disabled_at
        FROM auth_sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ?
        LIMIT 1
      `).get(tokenHash) as {
        user_id: string;
        expires_at: string;
        revoked_at: string | null;
        handle: string;
        role: 'user' | 'admin';
        email_verified_at: string | null;
        disabled_at: string | null;
      } | undefined;

      if (!row || row.revoked_at || row.disabled_at) {
        return null;
      }

      if (new Date(row.expires_at).getTime() < Date.now()) {
        return null;
      }

      return {
        userId: String(row.user_id),
        handle: String(row.handle),
        role: row.role,
        emailVerified: !!row.email_verified_at,
      };
    } catch {
      return null;
    }
  }

  return null;
}

export async function registerClientUploadRoutes(
  app: FastifyInstance,
  options: ClientUploadRoutesOptions
): Promise<void> {
  const { authService, db, storageRoot } = options;

  let uploadService = options.uploadService;
  if (!uploadService) {
    if (!db) {
      throw new Error('registerClientUploadRoutes requires either uploadService or db in options');
    }
    uploadService = new ClientProcessedUploadService(db, storageRoot);
  }

  // Register raw body parsers for stream uploads if not already present
  if (!app.hasContentTypeParser('application/octet-stream')) {
    app.addContentTypeParser('application/octet-stream', (_request, payload, done) => {
      done(null, payload);
    });
  }
  if (!app.hasContentTypeParser('image/webp')) {
    app.addContentTypeParser('image/webp', (_request, payload, done) => {
      done(null, payload);
    });
  }

  // Helper: require verified user (or admin)
  const requireVerifiedUser = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<SessionIdentity | null> => {
    const session = await getSessionFromRequest(request, authService, db);
    if (!session) {
      reply.code(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Inicia sesión para continuar.',
      });
      return null;
    }

    if (!session.emailVerified && session.role !== 'admin') {
      reply.code(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Debes verificar tu correo para subir capítulos.',
      });
      return null;
    }

    return session;
  };

  // Helper: require authenticated user (verified or not, e.g. for viewing own upload status)
  const requireAuthUser = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<SessionIdentity | null> => {
    const session = await getSessionFromRequest(request, authService, db);
    if (!session) {
      reply.code(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Inicia sesión para continuar.',
      });
      return null;
    }
    return session;
  };

  const handleServiceError = (err: any, reply: FastifyReply) => {
    if (err instanceof UploadServiceError || (err && typeof err.statusCode === 'number')) {
      return reply.code(err.statusCode).send({
        statusCode: err.statusCode,
        error: err.name || 'UploadError',
        message: err.message,
      });
    }
    return reply.code(500).send({
      statusCode: 500,
      error: 'InternalServerError',
      message: err?.message || 'Error interno del servidor durante la carga',
    });
  };

  // =========================================================================
  // 1. POST /api/v1/uploads — Start upload session
  // =========================================================================
  app.post<{ Body: CreateUploadInput }>(
    '/api/v1/uploads',
    async (request, reply) => {
      const session = await requireVerifiedUser(request, reply);
      if (!session) return;

      const body = request.body;
      if (!body) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'BadRequest',
          message: 'Falta el cuerpo de la solicitud para iniciar la carga',
        });
      }

      try {
        const result = await uploadService.createUpload(session.userId, body);
        return reply.code(201).send(result);
      } catch (err) {
        return handleServiceError(err, reply);
      }
    }
  );

  // =========================================================================
  // 2. GET /api/v1/uploads/:uploadId — Status and confirmed pages
  // =========================================================================
  app.get<{ Params: { uploadId: string } }>(
    '/api/v1/uploads/:uploadId',
    async (request, reply) => {
      const session = await requireAuthUser(request, reply);
      if (!session) return;

      const { uploadId } = request.params;
      try {
        const status = await uploadService.getUploadStatus(
          uploadId,
          session.userId,
          session.role === 'admin'
        );
        return reply.code(200).send(status);
      } catch (err) {
        return handleServiceError(err, reply);
      }
    }
  );

  // =========================================================================
  // 3. PUT /api/v1/uploads/:uploadId/pages/:pageNumber — Stream page body
  // =========================================================================
  app.put<{
    Params: { uploadId: string; pageNumber: string };
    Querystring: { width?: string; height?: string; sha256?: string; byteLength?: string };
  }>(
    '/api/v1/uploads/:uploadId/pages/:pageNumber',
    { bodyLimit: MAX_PAGE_BYTES },
    async (request, reply) => {
      const session = await requireVerifiedUser(request, reply);
      if (!session) return;

      const { uploadId, pageNumber: rawPageNumber } = request.params;
      const pageNumber = parseInt(rawPageNumber, 10);
      if (!Number.isInteger(pageNumber) || pageNumber < 1) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'BadRequest',
          message: 'Número de página inválido',
        });
      }

      // Extract metadata from headers or query params
      const width = Number(request.headers['x-page-width'] ?? request.query.width ?? 0);
      const height = Number(request.headers['x-page-height'] ?? request.query.height ?? 0);
      const sha256 = String(request.headers['x-page-sha256'] ?? request.query.sha256 ?? '').trim();
      const rawByteLength = request.headers['x-page-byte-length'] ??
        request.headers['content-length'] ??
        request.query.byteLength;
      const byteLength = Number(rawByteLength ?? 0);

      const metadata: UploadPageMetadata = {
        pageNumber,
        fileName: `${String(pageNumber).padStart(4, '0')}.webp`,
        width,
        height,
        aspectRatio: width > 0 && height > 0 ? Number((width / height).toFixed(4)) : 1,
        byteLength,
        mimeType: 'image/webp',
        sha256,
      };

      // Resolve stream
      let stream: NodeJS.ReadableStream;
      if (request.body && typeof (request.body as any).pipe === 'function') {
        stream = request.body as NodeJS.ReadableStream;
      } else if (Buffer.isBuffer(request.body)) {
        stream = Readable.from(request.body);
      } else {
        stream = request.raw;
      }

      try {
        const stored = await uploadService.storePageStream(
          uploadId,
          session.userId,
          pageNumber,
          metadata,
          stream
        );
        return reply.code(200).send(stored);
      } catch (err) {
        return handleServiceError(err, reply);
      }
    }
  );

  // =========================================================================
  // 4. POST /api/v1/uploads/:uploadId/complete — Validate manifest and publish
  // =========================================================================
  app.post<{
    Params: { uploadId: string };
    Body: ChapterManifest;
  }>(
    '/api/v1/uploads/:uploadId/complete',
    async (request, reply) => {
      const session = await requireVerifiedUser(request, reply);
      if (!session) return;

      const { uploadId } = request.params;
      const manifest = request.body;
      if (!manifest) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'BadRequest',
          message: 'Falta el manifiesto del capítulo en la solicitud',
        });
      }

      try {
        const result = await uploadService.finalizeUpload(uploadId, session.userId, manifest);
        return reply.code(200).send({
          success: true,
          ...result,
        });
      } catch (err) {
        return handleServiceError(err, reply);
      }
    }
  );

  // =========================================================================
  // 5. DELETE /api/v1/uploads/:uploadId — Cancel upload session
  // =========================================================================
  app.delete<{ Params: { uploadId: string } }>(
    '/api/v1/uploads/:uploadId',
    async (request, reply) => {
      const session = await requireAuthUser(request, reply);
      if (!session) return;

      const { uploadId } = request.params;
      try {
        await uploadService.cancelUpload(
          uploadId,
          session.userId,
          session.role === 'admin'
        );
        return reply.code(200).send({
          success: true,
          message: 'Sesión de carga cancelada exitosamente',
        });
      } catch (err) {
        return handleServiceError(err, reply);
      }
    }
  );

  // =========================================================================
  // 6. DELETE /api/v1/chapters/:chapterId — Author or admin withdrawal
  // =========================================================================
  app.delete<{ Params: { chapterId: string } }>(
    '/api/v1/chapters/:chapterId',
    async (request, reply) => {
      const session = await requireAuthUser(request, reply);
      if (!session) return;

      const { chapterId } = request.params;
      try {
        await uploadService.withdrawChapter(
          chapterId,
          session.userId,
          session.role === 'admin'
        );
        return reply.code(200).send({
          success: true,
          message: 'Capítulo retirado exitosamente',
        });
      } catch (err) {
        return handleServiceError(err, reply);
      }
    }
  );
}
