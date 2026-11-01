import { FastifyInstance } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import { ChapterRepository } from '../repositories/chapter-repository.js';
import { ingestChapter } from '../services/chapter-ingestion-service.js';

export function registerChapterRoutes(
  app: FastifyInstance,
  db: DatabaseInstance,
  storageRoot: string
): void {
  const repo = new ChapterRepository(db);

  // Get chapter manifest with zero-CLS page dimensions & navigation pointers
  app.get('/api/v1/chapters/:chapterId', async (req, reply) => {
    const { chapterId } = req.params as { chapterId: string };
    const detail = repo.getChapterWithPages(chapterId);

    if (!detail) {
      reply.status(404);
      return {
        statusCode: 404,
        error: 'Not Found',
        message: `Chapter with ID '${chapterId}' not found`,
      };
    }

    return detail;
  });

  // Trigger chapter ingestion & optimization
  app.post('/api/v1/chapters/ingest', async (req, reply) => {
    const body = req.body as {
      seriesSlug: string;
      volumeNumber?: number;
      chapterNumber: number;
      sourcePath: string;
      title?: string;
    };

    if (!body || !body.seriesSlug || typeof body.chapterNumber !== 'number' || !body.sourcePath) {
      reply.status(400);
      return {
        statusCode: 400,
        error: 'Bad Request',
        message: 'Missing required parameters: seriesSlug, chapterNumber, sourcePath',
      };
    }

    // Verify series exists in database
    const seriesStmt = db.prepare('SELECT id FROM series WHERE slug = ?');
    const seriesRow = seriesStmt.get(body.seriesSlug) as any;
    if (!seriesRow) {
      reply.status(404);
      return {
        statusCode: 404,
        error: 'Not Found',
        message: `Series with slug '${body.seriesSlug}' does not exist in catalog`,
      };
    }

    const ingestResult = await ingestChapter({
      storageRoot,
      seriesSlug: body.seriesSlug,
      volumeNumber: body.volumeNumber ?? 1,
      chapterNumber: body.chapterNumber,
      sourcePath: body.sourcePath,
    });

    const chapterId = `${body.seriesSlug}-c${body.chapterNumber}`;

    repo.createChapter({
      id: chapterId,
      seriesId: seriesRow.id,
      volumeId: null,
      chapterNumber: body.chapterNumber,
      title: body.title ?? `Chapter ${body.chapterNumber}`,
      pageCount: ingestResult.pageCount,
      storagePath: ingestResult.relativeStorageDir,
    });

    repo.addPages(chapterId, ingestResult.pages);

    return {
      success: true,
      chapterId,
      pageCount: ingestResult.pageCount,
      storagePath: ingestResult.relativeStorageDir,
      totalBytes: ingestResult.totalBytes,
    };
  });
}
