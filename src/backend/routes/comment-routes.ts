import { FastifyInstance } from 'fastify';
import crypto from 'node:crypto';
import { DatabaseInstance } from '../db/database.js';
import { CommentRepository } from '../repositories/comment-repository.js';
import { AuthService } from '../services/auth-service.js';
import { createAuthMiddleware } from '../middleware/auth-middleware.js';
import { createRateLimiter } from '../middleware/rate-limiter.js';

export function registerCommentRoutes(app: FastifyInstance, db: DatabaseInstance): void {
  const commentRepo = new CommentRepository(db);
  const authService = new AuthService(db);
  const authMiddleware = createAuthMiddleware(authService);

  const commentRateLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 10,
    message: 'Está enviando comentarios demasiado rápido. Por favor espere un momento.',
  });

  // GET /api/v1/comments - List comments for a series or chapter
  app.get('/api/v1/comments', async (req, reply) => {
    const query = req.query as {
      target_type?: string;
      target_id?: string;
      page?: string;
      limit?: string;
    };

    if (!query.target_type || !query.target_id) {
      reply.status(400);
      return {
        statusCode: 400,
        error: 'Bad Request',
        message: 'Debe especificar target_type (series | chapter) y target_id.',
      };
    }

    const targetType = query.target_type.toLowerCase();
    if (targetType !== 'series' && targetType !== 'chapter') {
      reply.status(400);
      return {
        statusCode: 400,
        error: 'Bad Request',
        message: 'target_type debe ser "series" o "chapter".',
      };
    }

    const visibleTarget = targetType === 'series'
      ? db.prepare("SELECT 1 FROM series WHERE id = ? AND COALESCE(visibility, 'published') = 'published'").get(query.target_id)
      : db.prepare(`
          SELECT 1 FROM chapters c JOIN series s ON s.id = c.series_id
          WHERE c.id = ? AND COALESCE(c.visibility, 'published') = 'published'
            AND COALESCE(s.visibility, 'published') = 'published'
        `).get(query.target_id);
    if (!visibleTarget) {
      return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'El contenido no existe o no está publicado.' });
    }

    const parsedPage = Number.parseInt(query.page || '1', 10);
    const parsedLimit = Number.parseInt(query.limit || '50', 10);
    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 100) : 50;

    const result = commentRepo.findComments(targetType, query.target_id, page, limit);

    return {
      items: result.items,
      total: result.total,
      page,
      limit,
    };
  });

  // POST /api/v1/comments - Create a new comment
  app.post(
    '/api/v1/comments',
    { preHandler: [authMiddleware.attachUser, authMiddleware.requireAuth, commentRateLimiter] },
    async (req, reply) => {
      const body = (req.body || {}) as {
        targetType?: string;
        targetId?: string;
        parentId?: string;
        body?: string;
      };

      if (!body.targetType || !body.targetId || !body.body) {
        reply.status(400);
        return {
          statusCode: 400,
          error: 'Bad Request',
          message: 'targetType, targetId y body son obligatorios.',
        };
      }

      const targetType = body.targetType.toLowerCase();
      if (targetType !== 'series' && targetType !== 'chapter') {
        reply.status(400);
        return {
          statusCode: 400,
          error: 'Bad Request',
          message: 'targetType debe ser "series" o "chapter".',
        };
      }

      const rawBody = body.body.trim();
      if (rawBody.length < 1 || rawBody.length > 2000) {
        reply.status(400);
        return {
          statusCode: 400,
          error: 'Bad Request',
          message: 'El comentario debe tener entre 1 y 2000 caracteres.',
        };
      }

      const commentId = crypto.randomUUID();
      const userId = req.user!.id;

      const visibleTarget = targetType === 'series'
        ? db.prepare("SELECT 1 FROM series WHERE id = ? AND COALESCE(visibility, 'published') = 'published'").get(body.targetId)
        : db.prepare(`
            SELECT 1 FROM chapters c JOIN series s ON s.id = c.series_id
            WHERE c.id = ? AND COALESCE(c.visibility, 'published') = 'published'
              AND COALESCE(s.visibility, 'published') = 'published'
          `).get(body.targetId);
      if (!visibleTarget) {
        return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'El contenido no existe o no está publicado.' });
      }

      if (body.parentId) {
        const parent = commentRepo.findById(body.parentId);
        if (!parent || parent.target_type !== targetType || parent.target_id !== body.targetId || parent.is_deleted) {
          return reply.code(400).send({ statusCode: 400, error: 'Bad Request', message: 'El comentario al que respondes no pertenece a este hilo.' });
        }
      }

      try {
        const comment = commentRepo.createComment({
          id: commentId,
          userId,
          targetType,
          targetId: body.targetId,
          parentId: body.parentId || null,
          body: rawBody,
        });

        reply.status(201);
        return {
          statusCode: 201,
          comment,
          message: 'Comentario publicado.',
        };
      } catch (err: any) {
        reply.status(400);
        return {
          statusCode: 400,
          error: 'Bad Request',
          message: err.message || 'Error al guardar el comentario.',
        };
      }
    }
  );

  // PUT /api/v1/comments/:id - Edit own comment
  app.put(
    '/api/v1/comments/:id',
    { preHandler: [authMiddleware.attachUser, authMiddleware.requireAuth, commentRateLimiter] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const body = (req.body || {}) as { body?: string };

      if (typeof body.body !== 'string') {
        reply.status(400);
        return {
          statusCode: 400,
          error: 'Bad Request',
          message: 'El contenido del comentario debe ser texto válido.',
        };
      }

      const rawBody = body.body.trim();
      if (rawBody.length < 1 || rawBody.length > 2000) {
        reply.status(400);
        return {
          statusCode: 400,
          error: 'Bad Request',
          message: 'El comentario debe tener entre 1 y 2000 caracteres.',
        };
      }

      const updated = commentRepo.updateComment(id, req.user!.id, rawBody);

      if (!updated) {
        reply.status(403);
        return {
          statusCode: 403,
          error: 'Forbidden',
          message: 'No puede editar este comentario.',
        };
      }

      return {
        statusCode: 200,
        comment: updated,
        message: 'Comentario modificado.',
      };
    }
  );

  // DELETE /api/v1/comments/:id - Soft delete comment (author or moderator/admin)
  app.delete(
    '/api/v1/comments/:id',
    { preHandler: [authMiddleware.attachUser, authMiddleware.requireAuth, commentRateLimiter] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const isPrivileged = req.user!.role === 'moderator' || req.user!.role === 'admin';

      const success = commentRepo.softDeleteComment(id, req.user!.id, isPrivileged);

      if (!success) {
        reply.status(403);
        return {
          statusCode: 403,
          error: 'Forbidden',
          message: 'No tiene permisos para eliminar este comentario.',
        };
      }

      return {
        statusCode: 200,
        ok: true,
        message: 'Comentario eliminado.',
      };
    }
  );
}
