import { FastifyInstance } from 'fastify';
import { DatabaseInstance } from '../db/database.js';

export function registerProgressRoutes(app: FastifyInstance, db: DatabaseInstance): void {
  // Get recent reading progress list (Must be declared before :seriesId)
  app.get('/api/v1/progress/recent', async (req, reply) => {
    const query = req.query as { userId?: string; limit?: string; titlePref?: string };
    const userId = query.userId || 'local_user';
    const limit = query.limit ? Math.min(50, Math.max(1, Number.parseInt(query.limit, 10))) : 15;
    const titlePref = (query.titlePref || '').toLowerCase();

    const stmt = db.prepare(`
      SELECT 
        up.user_id,
        up.series_id,
        up.chapter_id,
        up.page_number,
        up.scroll_offset_y,
        up.is_completed,
        up.updated_at,
        s.slug AS series_slug,
        s.title_primary AS series_title,
        s.cover_image,
        c.chapter_number,
        c.title AS chapter_title,
        c.page_count AS total_pages,
        (
          SELECT title FROM series_titles
          WHERE series_id = s.id AND (language_code IN ('ja-ro', 'ko-ro', 'ro', 'romaji') OR language_code LIKE '%ro%')
          ORDER BY is_primary DESC, id ASC
          LIMIT 1
        ) AS title_romaji,
        (
          SELECT title FROM series_titles
          WHERE series_id = s.id AND (language_code IN ('en', 'english') OR language_code LIKE 'en%')
          ORDER BY is_primary DESC, id ASC
          LIMIT 1
        ) AS title_english,
        (
          SELECT title FROM series_titles
          WHERE series_id = s.id AND (language_code IN ('native', 'ja', 'ko', 'zh') OR language_code LIKE 'ja%' OR language_code LIKE 'ko%' OR language_code LIKE 'zh%')
          ORDER BY is_primary DESC, id ASC
          LIMIT 1
        ) AS title_native
      FROM user_progress up
      LEFT JOIN series s ON up.series_id = s.id
      LEFT JOIN chapters c ON up.chapter_id = c.id
      WHERE up.user_id = ?
      ORDER BY up.updated_at DESC
      LIMIT ?
    `);

    const rows = stmt.all(userId, limit) as any[];

    const items = rows.map((row) => {
      const totalPages = Math.max(1, row.total_pages || 1);
      const pageNumber = row.page_number || 1;
      const progressPercent = Math.min(100, Math.round((pageNumber / totalPages) * 100));
      const canonicalTitle = row.series_title || 'Unknown Title';

      let preferredTitle = canonicalTitle;
      if (titlePref === 'romaji') {
        preferredTitle = row.title_romaji || canonicalTitle;
      } else if (titlePref === 'english') {
        preferredTitle = row.title_english || canonicalTitle;
      } else if (titlePref === 'native') {
        preferredTitle = row.title_native || canonicalTitle;
      } else {
        // Smart fallback: Romaji if available, then English, then Canonical
        preferredTitle = row.title_romaji || row.title_english || canonicalTitle;
      }

      return {
        seriesId: row.series_id,
        seriesTitle: canonicalTitle,
        titleCanonical: canonicalTitle,
        titlePreferred: preferredTitle,
        titles: {
          canonical: canonicalTitle,
          preferred: preferredTitle,
          romaji: row.title_romaji || null,
          english: row.title_english || null,
          native: row.title_native || null,
        },
        seriesSlug: row.series_slug || row.series_id,
        chapterId: row.chapter_id,
        chapterNumber: row.chapter_number ?? 1,
        chapterTitle: row.chapter_title || '',
        pageNumber,
        totalPages,
        progressPercent,
        isCompleted: Boolean(row.is_completed),
        updatedAt: row.updated_at,
        resume: {
          direction: 'LTR',
          scrollOffsetY: row.scroll_offset_y || 0,
          pageNumber,
        },
        thumbnails: {
          cover: row.cover_image ? `/api/v1/covers/${row.series_id}` : null,
          lastRead: row.chapter_id ? `/api/v1/chapters/${row.chapter_id}/pages/${pageNumber}` : null,
          coverAvailable: Boolean(row.cover_image),
          lastReadAvailable: Boolean(row.chapter_id),
        },
      };
    });

    return {
      items,
      count: items.length,
      limit,
    };
  });

  // Get reading progress for a series
  app.get('/api/v1/progress/:seriesId', async (req, reply) => {
    const { seriesId } = req.params as { seriesId: string };
    const query = req.query as { userId?: string; titlePref?: string };
    const userId = query.userId || 'local_user';
    const titlePref = (query.titlePref || '').toLowerCase();

    const stmt = db.prepare(`
      SELECT 
        up.user_id,
        up.series_id,
        up.chapter_id,
        up.page_number,
        up.scroll_offset_y,
        up.is_completed,
        up.updated_at,
        s.slug AS series_slug,
        s.title_primary AS series_title,
        (
          SELECT title FROM series_titles
          WHERE series_id = s.id AND (language_code IN ('ja-ro', 'ko-ro', 'ro', 'romaji') OR language_code LIKE '%ro%')
          ORDER BY is_primary DESC, id ASC
          LIMIT 1
        ) AS title_romaji,
        (
          SELECT title FROM series_titles
          WHERE series_id = s.id AND (language_code IN ('en', 'english') OR language_code LIKE 'en%')
          ORDER BY is_primary DESC, id ASC
          LIMIT 1
        ) AS title_english,
        (
          SELECT title FROM series_titles
          WHERE series_id = s.id AND (language_code IN ('native', 'ja', 'ko', 'zh') OR language_code LIKE 'ja%' OR language_code LIKE 'ko%' OR language_code LIKE 'zh%')
          ORDER BY is_primary DESC, id ASC
          LIMIT 1
        ) AS title_native
      FROM user_progress up
      LEFT JOIN series s ON up.series_id = s.id
      WHERE up.user_id = ? AND up.series_id = ?
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

    const canonicalTitle = row.series_title || 'Unknown Title';
    let preferredTitle = canonicalTitle;
    if (titlePref === 'romaji') {
      preferredTitle = row.title_romaji || canonicalTitle;
    } else if (titlePref === 'english') {
      preferredTitle = row.title_english || canonicalTitle;
    } else if (titlePref === 'native') {
      preferredTitle = row.title_native || canonicalTitle;
    } else {
      preferredTitle = row.title_romaji || row.title_english || canonicalTitle;
    }

    return {
      userId: row.user_id,
      seriesId: row.series_id,
      seriesTitle: canonicalTitle,
      titleCanonical: canonicalTitle,
      titlePreferred: preferredTitle,
      titles: {
        canonical: canonicalTitle,
        preferred: preferredTitle,
        romaji: row.title_romaji || null,
        english: row.title_english || null,
        native: row.title_native || null,
      },
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
