import { FastifyInstance } from 'fastify';
import { DatabaseInstance } from '../db/database.js';

export function registerProgressRoutes(app: FastifyInstance, db: DatabaseInstance): void {
  // Get reading progress for a series
  app.get('/api/v1/progress/:seriesId', async (req, reply) => {
    const { seriesId } = req.params as { seriesId: string };
    const query = req.query as { userId?: string };
    const userId = query.userId || 'local_user';

    const stmt = db.prepare(`
      SELECT user_id, series_id, chapter_id, page_number, scroll_offset_y, is_completed, updated_at
      FROM user_progress
      WHERE user_id = ? AND series_id = ?
    `);

    const row = stmt.get(userId, seriesId) as any;
    if (!row) {
      return {
        userId,
        seriesId,
        chapterId: null,
        pageNumber: 1,
        scrollOffsetY: 0,
        isCompleted: 0,
      };
    }

    return {
      userId: row.user_id,
      seriesId: row.series_id,
      chapterId: row.chapter_id,
      pageNumber: row.page_number,
      scrollOffsetY: row.scroll_offset_y,
      isCompleted: row.is_completed,
      updatedAt: row.updated_at,
    };
  });

  // Upsert reading progress
  app.post('/api/v1/progress', async (req, reply) => {
    const body = req.body as {
      userId?: string;
      seriesId: string;
      chapterId: string;
      pageNumber: number;
      scrollOffsetY?: number;
      isCompleted?: boolean;
    };

    if (!body || !body.seriesId || !body.chapterId || typeof body.pageNumber !== 'number') {
      reply.status(400);
      return {
        statusCode: 400,
        error: 'Bad Request',
        message: 'Missing required parameters: seriesId, chapterId, pageNumber',
      };
    }

    const userId = body.userId || 'local_user';
    const scrollOffsetY = body.scrollOffsetY ?? 0;
    const isCompleted = body.isCompleted ? 1 : 0;

    const stmt = db.prepare(`
      INSERT INTO user_progress (user_id, series_id, chapter_id, page_number, scroll_offset_y, is_completed, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(user_id, series_id) DO UPDATE SET
        chapter_id = excluded.chapter_id,
        page_number = excluded.page_number,
        scroll_offset_y = excluded.scroll_offset_y,
        is_completed = excluded.is_completed,
        updated_at = datetime('now')
    `);

    stmt.run(userId, body.seriesId, body.chapterId, body.pageNumber, scrollOffsetY, isCompleted);

    return {
      success: true,
      userId,
      seriesId: body.seriesId,
      chapterId: body.chapterId,
      pageNumber: body.pageNumber,
      isCompleted,
    };
  });
}
