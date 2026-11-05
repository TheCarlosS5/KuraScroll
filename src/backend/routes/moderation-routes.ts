import { FastifyInstance } from 'fastify';
import crypto from 'node:crypto';
import { DatabaseInstance } from '../db/database.js';
import { AuthService } from '../services/auth-service.js';
import { UserRepository, UserRole } from '../repositories/user-repository.js';
import { createAuthMiddleware } from '../middleware/auth-middleware.js';
import { createRateLimiter } from '../middleware/rate-limiter.js';

export function registerModerationRoutes(app: FastifyInstance, db: DatabaseInstance): void {
  const authService = new AuthService(db);
  const userRepo = new UserRepository(db);
  const authMiddleware = createAuthMiddleware(authService);

  const reportRateLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    maxRequests: 5,
    message: 'Ha enviado demasiadas denuncias. Por favor espere.',
  });

  // POST /api/v1/reports - Report inappropriate or infringing content
  app.post(
    '/api/v1/reports',
    { preHandler: [authMiddleware.attachUser, authMiddleware.requireAuth, reportRateLimiter] },
    async (req, reply) => {
      const body = (req.body || {}) as {
        targetType?: string;
        targetId?: string;
        reason?: string;
        description?: string;
      };

      const validTargetTypes = ['series', 'chapter', 'comment', 'user'];
      const validReasons = ['spam', 'harassment', 'copyright', 'inappropriate', 'other'];

      if (!body.targetType || !validTargetTypes.includes(body.targetType)) {
        reply.status(400);
        return {
          statusCode: 400,
          error: 'Bad Request',
          message: 'targetType inválido (series, chapter, comment, user).',
        };
      }

      if (!body.targetId) {
        reply.status(400);
        return {
          statusCode: 400,
          error: 'Bad Request',
          message: 'targetId es requerido.',
        };
      }

      if (!body.reason || !validReasons.includes(body.reason)) {
        reply.status(400);
        return {
          statusCode: 400,
          error: 'Bad Request',
          message: 'Motivo de denuncia inválido (spam, harassment, copyright, inappropriate, other).',
        };
      }

      const reportId = crypto.randomUUID();
      const reporterUserId = req.user!.id;
      const targetExists = body.targetType === 'series'
        ? db.prepare('SELECT 1 FROM series WHERE id = ?').get(body.targetId)
        : body.targetType === 'chapter'
          ? db.prepare('SELECT 1 FROM chapters WHERE id = ?').get(body.targetId)
          : body.targetType === 'comment'
            ? db.prepare('SELECT 1 FROM comments WHERE id = ?').get(body.targetId)
            : db.prepare('SELECT 1 FROM users WHERE id = ?').get(body.targetId);
      if (!targetExists) {
        return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'El contenido denunciado no existe.' });
      }

      try {
        const stmt = db.prepare(`
          INSERT INTO content_reports (
            id, reporter_user_id, target_type, target_id, reason, description
          ) VALUES (?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
          reportId,
          reporterUserId,
          body.targetType,
          body.targetId,
          body.reason,
          body.description ? body.description.substring(0, 1000) : null
        );

        reply.status(201);
        return {
          statusCode: 201,
          ok: true,
          reportId,
          message: 'Denuncia registrada. El equipo de moderación revisará el caso.',
        };
      } catch (err: any) {
        reply.status(400);
        return {
          statusCode: 400,
          error: 'Bad Request',
          message: err.message || 'Error al procesar la denuncia.',
        };
      }
    }
  );

  // GET /api/v1/admin/reports - List reports (Moderators & Admins)
  app.get(
    '/api/v1/admin/reports',
    { preHandler: [authMiddleware.attachUser, authMiddleware.requireRole('moderator', 'admin')] },
    async (req) => {
      const query = req.query as { status?: string };
      const statusFilter = query.status || 'pending';

      const stmt = db.prepare(`
        SELECT r.*, u.handle as reporter_handle
        FROM content_reports r
        LEFT JOIN users u ON u.id = r.reporter_user_id
        WHERE r.status = ?
        ORDER BY r.created_at DESC
        LIMIT 100
      `);

      const reports = stmt.all(statusFilter) as any[];

      return {
        reports: reports.map((r) => ({
          id: r.id,
          reporterUserId: r.reporter_user_id,
          reporterHandle: r.reporter_handle,
          targetType: r.target_type,
          targetId: r.target_id,
          reason: r.reason,
          description: r.description,
          status: r.status,
          resolvedBy: r.resolved_by,
          resolutionNotes: r.resolution_notes,
          resolvedAt: r.resolved_at,
          createdAt: r.created_at,
        })),
      };
    }
  );

  // PUT /api/v1/admin/reports/:id - Resolve or dismiss report (Moderators & Admins)
  app.put(
    '/api/v1/admin/reports/:id',
    { preHandler: [authMiddleware.attachUser, authMiddleware.requireRole('moderator', 'admin')] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const body = (req.body || {}) as {
        status?: string;
        notes?: string;
      };

      const allowedStatuses = ['reviewed', 'resolved', 'dismissed'];
      if (!body.status || !allowedStatuses.includes(body.status)) {
        reply.status(400);
        return {
          statusCode: 400,
          error: 'Bad Request',
          message: 'Estado inválido (reviewed, resolved, dismissed).',
        };
      }
      const notes = typeof body.notes === 'string' ? body.notes.slice(0, 1000) : null;

      const stmt = db.prepare(`
        UPDATE content_reports
        SET status = ?, resolved_by = ?, resolution_notes = ?, resolved_at = datetime('now')
        WHERE id = ?
      `);

      const result = stmt.run(body.status, req.user!.id, notes, id);
      if (Number(result.changes || 0) === 0) {
        return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Denuncia no encontrada.' });
      }

      return {
        statusCode: 200,
        ok: true,
        message: 'Estado de denuncia actualizado.',
      };
    }
  );

  // PUT /api/v1/admin/users/:userId/role - Change user role (Admins only)
  app.put(
    '/api/v1/admin/users/:userId/role',
    { preHandler: [authMiddleware.attachUser, authMiddleware.requireRole('admin')] },
    async (req, reply) => {
      const { userId } = req.params as { userId: string };
      const body = (req.body || {}) as { role?: string };

      const validRoles: UserRole[] = ['user', 'moderator', 'admin'];
      if (!body.role || !validRoles.includes(body.role as UserRole)) {
        reply.status(400);
        return {
          statusCode: 400,
          error: 'Bad Request',
          message: 'Rol inválido (user, moderator, admin).',
        };
      }

      const targetUser = userRepo.findById(userId);
      if (!targetUser) {
        reply.status(404);
        return {
          statusCode: 404,
          error: 'Not Found',
          message: 'Usuario no encontrado.',
        };
      }

      userRepo.updateRole(userId, body.role as UserRole);

      return {
        statusCode: 200,
        ok: true,
        message: `Rol de @${targetUser.handle} actualizado a "${body.role}".`,
      };
    }
  );
}
