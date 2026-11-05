import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'node:crypto';
import { DatabaseInstance } from '../db/database.js';
import { CommunityService, TargetType, ReportStatus, ContentStatus } from '../services/community-service.js';

export interface SessionIdentity {
  userId: string;
  handle: string;
  role: 'user' | 'admin';
  emailVerified: boolean;
}

export interface CommunityRoutesOptions {
  communityService: CommunityService;
  authService?: {
    getSession(token: string): Promise<SessionIdentity | null>;
  };
  db?: DatabaseInstance;
}

/**
 * Extracts and resolves the current session identity from request or database fallback.
 */
export async function getSessionFromRequest(
  request: FastifyRequest,
  authService?: { getSession(token: string): Promise<SessionIdentity | null> },
  db?: DatabaseInstance
): Promise<SessionIdentity | null> {
  // 1. Upstream middleware or hook attached sessionIdentity
  if ((request as any).sessionIdentity) {
    return (request as any).sessionIdentity;
  }

  // 2. Extract session token from cookie or Authorization header
  let rawToken: string | null = null;
  const cookieHeader = request.headers.cookie;
  if (cookieHeader) {
    const match = cookieHeader.match(/(?:^|;\s*)ks_session=([^;]+)/);
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

  // 3. Resolve through authService if provided
  if (authService) {
    try {
      const session = await authService.getSession(rawToken);
      if (session) return session;
    } catch {
      // Fallback to direct DB lookup
    }
  }

  // 4. Resolve directly via SQLite tables if db is provided
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
      `).get(tokenHash) as any;

      if (!row || row.revoked_at || row.disabled_at) {
        return null;
      }

      if (new Date(row.expires_at).getTime() < Date.now()) {
        return null;
      }

      return {
        userId: String(row.user_id),
        handle: String(row.handle),
        role: row.role as 'user' | 'admin',
        emailVerified: !!row.email_verified_at,
      };
    } catch {
      return null;
    }
  }

  return null;
}

export async function registerCommunityRoutes(
  app: FastifyInstance,
  options: CommunityRoutesOptions
): Promise<void> {
  const { communityService, authService, db } = options;

  // Helper for authenticated user with verified email
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

    if (!session.emailVerified) {
      reply.code(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Debes verificar tu correo para realizar esta acción.',
      });
      return null;
    }

    return session;
  };

  // Helper for admin role
  const requireAdmin = async (
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

    if (session.role !== 'admin') {
      reply.code(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Acceso reservado a administradores.',
      });
      return null;
    }

    return session;
  };

  // =========================================================================
  // Public Profiles
  // =========================================================================

  // GET /api/v1/users/:handle -> PublicProfile (no email/private reading stats)
  app.get<{ Params: { handle: string } }>(
    '/api/v1/users/:handle',
    async (request, reply) => {
      const { handle } = request.params;
      const profile = communityService.getPublicProfile(handle);
      if (!profile) {
        return reply.code(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Perfil no encontrado.',
        });
      }
      return reply.send({ profile });
    }
  );

  // PUT /api/v1/users/me -> updates own profile displayName and bio
  app.put<{ Body: { displayName?: string | null; bio?: string | null } }>(
    '/api/v1/users/me',
    async (request, reply) => {
      const session = await requireVerifiedUser(request, reply);
      if (!session) return;

      try {
        const profile = communityService.updateMyProfile(session.userId, request.body || {});
        return reply.send({ profile });
      } catch (err: any) {
        const isRateLimit = err.message && err.message.includes('espera');
        const code = isRateLimit ? 429 : 400;
        return reply.code(code).send({
          statusCode: code,
          error: isRateLimit ? 'Too Many Requests' : 'Bad Request',
          message: err.message || 'Error al actualizar el perfil.',
        });
      }
    }
  );

  // =========================================================================
  // Comments
  // =========================================================================

  // GET /api/v1/series/:slug/comments -> Paginated published comments
  app.get<{ Params: { slug: string }; Querystring: { cursor?: string; limit?: string } }>(
    '/api/v1/series/:slug/comments',
    async (request, reply) => {
      const { slug } = request.params;
      const { cursor, limit } = request.query;
      const limitNum = limit ? parseInt(limit, 10) : 20;

      const result = communityService.listComments(slug, cursor, limitNum);
      return reply.send(result);
    }
  );

  // POST /api/v1/series/:slug/comments -> Create comment
  app.post<{ Params: { slug: string }; Body: { body: string; hasSpoiler?: boolean } }>(
    '/api/v1/series/:slug/comments',
    async (request, reply) => {
      const session = await requireVerifiedUser(request, reply);
      if (!session) return;

      const { slug } = request.params;
      const { body, hasSpoiler } = request.body || {};

      try {
        const comment = communityService.createComment(
          session.userId,
          slug,
          body,
          hasSpoiler
        );
        return reply.code(201).send({ comment });
      } catch (err: any) {
        const isRateLimit = err.message && err.message.includes('espera');
        const code = isRateLimit ? 429 : 400;
        return reply.code(code).send({
          statusCode: code,
          error: isRateLimit ? 'Too Many Requests' : 'Bad Request',
          message: err.message || 'Error al crear el comentario.',
        });
      }
    }
  );

  // DELETE /api/v1/comments/:commentId -> Author or Admin
  app.delete<{ Params: { commentId: string } }>(
    '/api/v1/comments/:commentId',
    async (request, reply) => {
      const session = await getSessionFromRequest(request, authService, db);
      if (!session) {
        return reply.code(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Inicia sesión para eliminar comentarios.',
        });
      }

      const { commentId } = request.params;
      try {
        const result = communityService.deleteComment(commentId, session.userId, session.role);
        return reply.send(result);
      } catch (err: any) {
        const isForbidden = err.message && err.message.includes('No tienes permiso');
        const isNotFound = err.message && err.message.includes('no encontrado');
        const code = isForbidden ? 403 : isNotFound ? 404 : 400;
        return reply.code(code).send({
          statusCode: code,
          error: isForbidden ? 'Forbidden' : isNotFound ? 'Not Found' : 'Bad Request',
          message: err.message || 'Error al eliminar el comentario.',
        });
      }
    }
  );

  // =========================================================================
  // Reports
  // =========================================================================

  // POST /api/v1/reports -> Submit deduplicated report
  app.post<{ Body: { targetType: TargetType; targetId: string; reason: string } }>(
    '/api/v1/reports',
    async (request, reply) => {
      const session = await requireVerifiedUser(request, reply);
      if (!session) return;

      const { targetType, targetId, reason } = request.body || {};
      try {
        const report = communityService.createReport(session.userId, targetType, targetId, reason);
        return reply.code(201).send({ success: true, report });
      } catch (err: any) {
        const isRateLimit = err.message && err.message.includes('espera');
        const code = isRateLimit ? 429 : 400;
        return reply.code(code).send({
          statusCode: code,
          error: isRateLimit ? 'Too Many Requests' : 'Bad Request',
          message: err.message || 'Error al enviar el reporte.',
        });
      }
    }
  );

  // =========================================================================
  // Admin Moderation
  // =========================================================================

  // GET /api/v1/admin/reports -> Admin queue
  app.get<{ Querystring: { status?: ReportStatus; cursor?: string; limit?: string } }>(
    '/api/v1/admin/reports',
    async (request, reply) => {
      const admin = await requireAdmin(request, reply);
      if (!admin) return;

      const { status, cursor, limit } = request.query;
      const limitNum = limit ? parseInt(limit, 10) : 20;

      const result = communityService.listReports(status, cursor, limitNum);
      return reply.send(result);
    }
  );

  // PATCH /api/v1/admin/reports/:reportId -> Resolve or dismiss report with optional action
  app.patch<{
    Params: { reportId: string };
    Body: { status: ReportStatus; action?: 'none' | 'hide' | 'restore' | 'remove' };
  }>('/api/v1/admin/reports/:reportId', async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin) return;

    const { reportId } = request.params;
    const { status, action } = request.body || {};

    if (!status || !['resolved', 'dismissed'].includes(status)) {
      return reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Estado de resolución inválido (debe ser resolved o dismissed).',
      });
    }

    try {
      const result = communityService.resolveReport(reportId, admin.userId, status, action);
      return reply.send({ success: true, report: result });
    } catch (err: any) {
      return reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: err.message || 'Error al resolver el reporte.',
      });
    }
  });

  // PATCH /api/v1/admin/chapters/:chapterId/visibility
  app.patch<{ Params: { chapterId: string }; Body: { status: ContentStatus } }>(
    '/api/v1/admin/chapters/:chapterId/visibility',
    async (request, reply) => {
      const admin = await requireAdmin(request, reply);
      if (!admin) return;

      const { chapterId } = request.params;
      const { status } = request.body || {};

      if (!status || !['published', 'hidden', 'removed'].includes(status)) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Estado de visibilidad inválido (debe ser published, hidden o removed).',
        });
      }

      try {
        const result = communityService.updateVisibility('chapter', chapterId, admin.userId, status);
        return reply.send(result);
      } catch (err: any) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: err.message || 'Error al actualizar visibilidad del capítulo.',
        });
      }
    }
  );

  // PATCH /api/v1/admin/series/:slug/visibility
  app.patch<{ Params: { slug: string }; Body: { status: ContentStatus } }>(
    '/api/v1/admin/series/:slug/visibility',
    async (request, reply) => {
      const admin = await requireAdmin(request, reply);
      if (!admin) return;

      const { slug } = request.params;
      const { status } = request.body || {};

      if (!status || !['published', 'hidden', 'removed'].includes(status)) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Estado de visibilidad inválido (debe ser published, hidden o removed).',
        });
      }

      try {
        const result = communityService.updateVisibility('series', slug, admin.userId, status);
        return reply.send(result);
      } catch (err: any) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: err.message || 'Error al actualizar visibilidad de la serie.',
        });
      }
    }
  );

  // PATCH /api/v1/admin/comments/:commentId/visibility
  app.patch<{ Params: { commentId: string }; Body: { status: ContentStatus } }>(
    '/api/v1/admin/comments/:commentId/visibility',
    async (request, reply) => {
      const admin = await requireAdmin(request, reply);
      if (!admin) return;

      const { commentId } = request.params;
      const { status } = request.body || {};

      if (!status || !['published', 'hidden', 'removed'].includes(status)) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Estado de visibilidad inválido (debe ser published, hidden o removed).',
        });
      }

      try {
        const result = communityService.updateVisibility('comment', commentId, admin.userId, status);
        return reply.send(result);
      } catch (err: any) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: err.message || 'Error al actualizar visibilidad del comentario.',
        });
      }
    }
  );
}
