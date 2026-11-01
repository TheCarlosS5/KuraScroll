import { FastifyInstance } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import { SeriesRepository } from '../repositories/series-repository.js';

export function registerSeriesRoutes(app: FastifyInstance, db: DatabaseInstance): void {
  const repo = new SeriesRepository(db);

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

    // Fetch chapters for this series
    const chaptersStmt = db.prepare(`
      SELECT id, chapter_number, title, page_count, storage_path, created_at
      FROM chapters
      WHERE series_id = ?
      ORDER BY chapter_number ASC
    `);
    const chapters = chaptersStmt.all(series.id) as any[];

    return {
      ...series,
      chapters: chapters.map((c) => ({
        id: c.id,
        chapterNumber: c.chapter_number,
        title: c.title,
        pageCount: c.page_count,
        storagePath: c.storage_path,
        createdAt: c.created_at,
      })),
    };
  });
}
