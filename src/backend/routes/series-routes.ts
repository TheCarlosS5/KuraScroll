import { FastifyInstance } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import { SeriesRepository } from '../repositories/series-repository.js';
import { AuthService } from '../services/auth-service.js';
import { extractSessionToken } from '../middleware/auth-middleware.js';

export function registerSeriesRoutes(app: FastifyInstance, db: DatabaseInstance): void {
  const repo = new SeriesRepository(db);
  const authService = new AuthService(db);

  // List series / search
  app.get('/api/v1/series', async (req, reply) => {
    const query = req.query as {
      q?: string;
      type?: string;
      status?: string;
      genre?: string;
      page?: string;
      limit?: string;
    };

    const limit = query.limit ? Number.parseInt(query.limit, 10) : 20;
    const page = query.page ? Number.parseInt(query.page, 10) : 1;

    const result = repo.listSeries({
      q: query.q,
      type: query.type,
      status: query.status,
      genre: query.genre,
      page,
      limit,
    });

    return {
      items: result.items,
      total: result.total,
      page,
      limit,
    };
  });

  // Get single series by slug
  app.get('/api/v1/series/:slug', async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const series = repo.getSeriesBySlug(slug);

    if (!series) {
      reply.status(404);
      return {
        statusCode: 404,
        error: 'Not Found',
        message: `Series with slug '${slug}' not found`,
      };
    }

    const token = extractSessionToken(req);
    const user = token ? authService.validateSessionToken(token) : null;
    const canManage = Boolean(user && (user.id === series.uploaderUserId || user.role === 'admin' || user.role === 'moderator'));

    if (series.visibility !== 'published' && !canManage) {
      reply.status(404);
      return {
        statusCode: 404,
        error: 'Not Found',
        message: `Series with slug '${slug}' not found`,
      };
    }

    // Fetch chapters for this series (published for catalog, all for owner/admin)
    const chaptersStmt = db.prepare(`
      SELECT id, chapter_number, title, page_count, storage_path, visibility, created_at
      FROM chapters
      WHERE series_id = ? AND (visibility = 'published' OR visibility IS NULL OR ? = 1)
      ORDER BY chapter_number ASC
    `);
    const chapters = chaptersStmt.all(series.id, canManage ? 1 : 0) as any[];

    return {
      ...series,
      chapters: chapters.map((c) => ({
        id: c.id,
        chapterNumber: c.chapter_number,
        title: c.title,
        pageCount: c.page_count,
        storagePath: c.storage_path,
        visibility: c.visibility ?? 'published',
        createdAt: c.created_at,
      })),
    };
  });
}
