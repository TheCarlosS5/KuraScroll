import { FastifyInstance } from 'fastify';
import path from 'node:path';
import fs from 'node:fs';
import { DatabaseInstance } from '../db/database.js';
import { ChapterRepository } from '../repositories/chapter-repository.js';
import { ingestChapter } from '../services/chapter-ingestion-service.js';
import { manifestLoader, imageLoader, manifestCache, imageCache } from '../cache/media-cache.js';

export function registerChapterRoutes(
  app: FastifyInstance,
  db: DatabaseInstance,
  storageRoot: string
): void {
  const repo = new ChapterRepository(db);

  // Cache metrics endpoint
  app.get('/api/v1/metrics/cache', async () => {
    return {
      manifestCache: manifestCache.getMetrics(),
      imageCache: imageCache.getMetrics(),
    };
  });

  // Get chapter manifest with zero-CLS page dimensions & navigation pointers (LRU cached)
  app.get('/api/v1/chapters/:chapterId', async (req, reply) => {
    const { chapterId } = req.params as { chapterId: string };

    const detail = await manifestLoader.getOrLoad(chapterId, async () => {
      const dbResult = repo.getChapterWithPages(chapterId);
      if (!dbResult) return null;
      const sizeBytes = Buffer.byteLength(JSON.stringify(dbResult), 'utf8') * 2;
      return { value: dbResult, size: sizeBytes };
    });

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

  // Get chapter page image directly with ByteLRU memory caching for 4TB HDD de-thrashing
  app.get('/api/v1/chapters/:chapterId/pages/:pageFile', async (req, reply) => {
    const { chapterId, pageFile } = req.params as { chapterId: string; pageFile: string };

    // Prevent directory traversal on pageFile
    if (pageFile.includes('..') || pageFile.includes('/') || pageFile.includes('\\')) {
      reply.status(400);
      return { statusCode: 400, error: 'Bad Request', message: 'Invalid page file name' };
    }

    const cacheKey = `${chapterId}/${pageFile}`;
    const buffer = await imageLoader.getOrLoad(cacheKey, async () => {
      const chapter = repo.getChapter(chapterId);
      if (!chapter) return null;

      const physicalPath = path.join(storageRoot, chapter.storagePath, pageFile);
      if (!fs.existsSync(physicalPath)) return null;

      const fileBuffer = await fs.promises.readFile(physicalPath);
      return { value: fileBuffer, size: fileBuffer.length };
    });

    if (!buffer) {
      reply.status(404);
      return {
        statusCode: 404,
        error: 'Not Found',
        message: `Page '${pageFile}' not found for chapter '${chapterId}'`,
      };
    }

    const isSaveData = req.headers['save-data'] === 'on' || (req.query as any)?.saveData === '1';
    if (isSaveData) {
      reply.header('Vary', 'Save-Data');
      reply.header('X-Save-Data', 'active');
    }

    reply
      .header('Content-Type', 'image/webp')
      .header('Cache-Control', 'public, max-age=31536000, immutable')
      .send(buffer);
  });

  // Trigger chapter ingestion & optimization
  app.post('/api/v1/chapters/ingest', async (req, reply) => {
    const body = req.body as {
      seriesSlug: string;
      volumeNumber?: number;
      chapterNumber: number;
      sourcePath: string;
      title?: string;
      thermalSaver?: boolean;
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

    try {
      const ingestResult = await ingestChapter({
        storageRoot,
        seriesSlug: body.seriesSlug,
        volumeNumber: body.volumeNumber ?? 1,
        chapterNumber: body.chapterNumber,
        sourcePath: body.sourcePath,
        thermalSaver: body.thermalSaver,
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
    } catch (err: any) {
      reply.status(400);
      return {
        statusCode: 400,
        error: 'Bad Request',
        message: err.message || 'Chapter ingestion failed',
      };
    }
  });
}
