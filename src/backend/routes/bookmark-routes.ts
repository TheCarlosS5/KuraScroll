import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { BookmarkRepository } from '../repositories/bookmark-repository.js';
import type { DatabaseInstance } from '../db/database.js';
import { AuthService } from '../services/auth-service.js';
import { createAuthMiddleware } from '../middleware/auth-middleware.js';
import { getAppConfig } from '../config/app-config.js';

export interface BookmarkRouteOptions {
  db: DatabaseInstance;
}

export const bookmarkRoutes: FastifyPluginAsync<BookmarkRouteOptions> = async (
  app: FastifyInstance,
  options: BookmarkRouteOptions
) => {
  const repo = new BookmarkRepository(options.db);
  const config = getAppConfig();
  const auth = createAuthMiddleware(new AuthService(options.db));
  const bookmarkPreHandler = [auth.attachUser];
  const getUserId = (request: Parameters<typeof auth.attachUser>[0]): string => {
    if (request.user?.id) return request.user.id;
    const headerUserId = request.headers['x-user-id'];
    return typeof headerUserId === 'string' && headerUserId.trim() ? headerUserId.trim() : 'local_user';
  };

  // Quick Index for Series Chapters, Progress, and Bookmark Counters (< 0.8ms SLA)
  app.get('/api/v1/series/:seriesId/chapters/quick-index', { preHandler: bookmarkPreHandler }, async (req, reply) => {
    const { seriesId } = req.params as { seriesId: string };
    const userId = getUserId(req);

    const quickIndex = repo.getSeriesQuickIndex(userId, seriesId);
    return quickIndex;
  });

  // Get all bookmarks for a specific series (chronological order)
  app.get('/api/v1/series/:seriesId/bookmarks', { preHandler: bookmarkPreHandler }, async (req, reply) => {
    const { seriesId } = req.params as { seriesId: string };
    const userId = getUserId(req);

    const bookmarks = repo.getBookmarksForSeries(userId, seriesId);
    return { seriesId, total: bookmarks.length, bookmarks };
  });

  // Get all bookmarks for active chapter
  app.get('/api/v1/chapters/:chapterId/bookmarks', { preHandler: bookmarkPreHandler }, async (req, reply) => {
    const { chapterId } = req.params as { chapterId: string };
    const userId = getUserId(req);

    const bookmarks = repo.getBookmarksForChapter(userId, chapterId);
    return { chapterId, total: bookmarks.length, bookmarks };
  });

  // Create or Update (UPSERT) a bookmark
  app.post('/api/v1/bookmarks', { preHandler: bookmarkPreHandler }, async (req, reply) => {
    const userId = getUserId(req);
    const body = req.body as {
      seriesId: string;
      chapterId: string;
      pageIndex: number;
      note?: string | null;
    };

    if (!body || !body.seriesId || !body.chapterId || body.pageIndex === undefined || body.pageIndex === null) {
      reply.status(400);
      return {
        statusCode: 400,
        error: 'Bad Request',
        message: 'Missing required fields: seriesId, chapterId, pageIndex',
      };
    }

    if (body.pageIndex < 0) {
      reply.status(400);
      return {
        statusCode: 400,
        error: 'Bad Request',
        message: 'pageIndex must be non-negative',
      };
    }

    const bookmark = repo.createOrUpdateBookmark({
      userId,
      seriesId: body.seriesId,
      chapterId: body.chapterId,
      pageIndex: Number(body.pageIndex),
      note: body.note,
    });

    reply.status(201);
    return { success: true, bookmark };
  });

  // Delete bookmark by ID
  app.delete('/api/v1/bookmarks/:id', { preHandler: bookmarkPreHandler }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const userId = getUserId(req);

    const numId = parseInt(id, 10);
    if (isNaN(numId)) {
      reply.status(400);
      return { statusCode: 400, error: 'Bad Request', message: 'Invalid bookmark ID' };
    }

    const deleted = repo.deleteBookmark(userId, numId);
    if (!deleted) {
      reply.status(404);
      return { statusCode: 404, error: 'Not Found', message: 'Bookmark not found or already deleted' };
    }

    return { success: true, deleted: true, id: numId };
  });

  // Delete bookmark by location (chapterId + pageIndex)
  app.delete('/api/v1/chapters/:chapterId/bookmarks/:pageIndex', { preHandler: bookmarkPreHandler }, async (req, reply) => {
    const { chapterId, pageIndex } = req.params as { chapterId: string; pageIndex: string };
    const userId = getUserId(req);

    const numPageIndex = parseInt(pageIndex, 10);
    if (isNaN(numPageIndex)) {
      reply.status(400);
      return { statusCode: 400, error: 'Bad Request', message: 'Invalid pageIndex' };
    }

    const deleted = repo.deleteBookmarkByLocation(userId, chapterId, numPageIndex);
    return { success: true, deleted, chapterId, pageIndex: numPageIndex };
  });
};
