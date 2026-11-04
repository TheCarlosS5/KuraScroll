import { FastifyInstance } from 'fastify';
import { PassThrough } from 'node:stream';
import path from 'node:path';
import fs from 'node:fs';
import { DatabaseInstance } from '../db/database.js';
import { ChapterRepository } from '../repositories/chapter-repository.js';
import { ingestChapter } from '../services/chapter-ingestion-service.js';
import { manifestLoader, imageLoader, manifestCache, imageCache } from '../cache/media-cache.js';
import { ImageIntegrityService } from '../services/image-integrity-service.js';
import { sharedIOCoordinator } from '../storage/io/io-coordinator.js';
import { IOPriority } from '../storage/io/io-priority.js';
import { resolveAssetTier, resolveIOPriority, ASSET_TIER_CONFIG } from '../config/asset-tier-config.js';
import { CbzArchiveStreamer, CbzPageItem } from '../services/cbz-archive-streamer.js';

function resolveUnderRoot(root: string, relativePath: unknown): string | null {
  if (typeof relativePath !== 'string' || !relativePath || path.isAbsolute(relativePath)) return null;
  const resolvedRoot = path.resolve(root);
  const resolvedPath = path.resolve(resolvedRoot, relativePath);
  const relative = path.relative(resolvedRoot, resolvedPath);
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return null;
  return resolvedPath;
}

function isRealPathUnderRoot(root: string, candidate: string): boolean {
  try {
    const realRoot = fs.realpathSync(root);
    const realCandidate = fs.realpathSync(candidate);
    const relative = path.relative(realRoot, realCandidate);
    return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
  } catch {
    return false;
  }
}

export function registerChapterRoutes(
  app: FastifyInstance,
  db: DatabaseInstance,
  storageRoot: string,
  incomingRoot = path.resolve(storageRoot, 'incoming')
): void {
  const repo = new ChapterRepository(db);
  const integrityService = new ImageIntegrityService({ db, storageRoot });

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

    const tier = resolveAssetTier(req.headers as any, req.query as any);
    const ioPriority = resolveIOPriority(req.headers as any, req.query as any);
    const isPrefetch = ioPriority === IOPriority.NORMAL;

    const cacheKey = `${chapterId}/${pageFile}:${tier}`;
    const buffer = await imageLoader.getOrLoad(cacheKey, async () => {
      return sharedIOCoordinator.run(
        { priority: ioPriority, label: `read-${cacheKey}` },
        async () => {
          const chapter = repo.getChapter(chapterId);
          if (!chapter) return null;

          const chapterDir = resolveUnderRoot(storageRoot, chapter.storagePath);
          if (!chapterDir) return null;
          const physicalPath = path.resolve(chapterDir, pageFile);
          if (!resolveUnderRoot(chapterDir, pageFile) || !fs.existsSync(physicalPath) || !isRealPathUnderRoot(storageRoot, physicalPath)) return null;

          try {
            const fileBuffer = await fs.promises.readFile(physicalPath);
            // Fast header check for zeroed-out bad sector
            if (fileBuffer.length < 16 || fileBuffer.subarray(0, 4).toString('ascii') !== 'RIFF') {
              integrityService.logCorruptFile(physicalPath, chapterId, 'bad_block_or_corrupted_magic_header');
              const fallback = integrityService.getFallbackPlaceholderWebP();
              return { value: fallback, size: fallback.length };
            }
            return { value: fileBuffer, size: fileBuffer.length };
          } catch (err: any) {
            integrityService.logCorruptFile(physicalPath, chapterId, `disk_io_error: ${err.message}`);
            const fallback = integrityService.getFallbackPlaceholderWebP();
            return { value: fallback, size: fallback.length };
          }
        }
      );
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
      reply.header('Vary', 'Save-Data, Sec-CH-Viewport-Width');
      reply.header('X-Save-Data', 'active');
    }

    reply.header('X-Asset-Tier', tier);
    reply.header('X-IO-Priority', ioPriority === IOPriority.CRITICAL ? 'CRITICAL' : 'NORMAL');
    if (isPrefetch) {
      reply.header('X-Prefetch-Handled', 'true');
    }

    reply
      .header('Content-Type', 'image/webp')
      .header('Cache-Control', ASSET_TIER_CONFIG[tier].cacheControl)
      .send(buffer);
  });

  // Export chapter as standardized .cbz archive with streaming STORE compression (Sprint 40)
  app.get('/api/v1/chapters/:chapterId/export/cbz', async (req, reply) => {
    const { chapterId } = req.params as { chapterId: string };
    const detail = repo.getChapterWithPages(chapterId);

    if (!detail) {
      reply.status(404);
      return { statusCode: 404, error: 'Not Found', message: `Chapter '${chapterId}' not found` };
    }

    const { chapter, pages } = detail;

    const seriesStmt = db.prepare('SELECT title_primary, synopsis, author FROM series WHERE id = ?');
    const series = seriesStmt.get(chapter.seriesId) as any;

    const chapterDir = resolveUnderRoot(storageRoot, chapter.storagePath);
    if (!chapterDir) {
      reply.status(409);
      return { statusCode: 409, error: 'Conflict', message: 'Chapter has an invalid storage path' };
    }
    const pageItems: CbzPageItem[] = [];
    for (const page of pages) {
      const absolutePath = resolveUnderRoot(chapterDir, page.fileName);
      if (!absolutePath || !isRealPathUnderRoot(storageRoot, absolutePath)) {
        reply.status(409);
        return { statusCode: 409, error: 'Conflict', message: 'Chapter contains an invalid page path' };
      }
      pageItems.push({ pageNumber: page.pageNumber, fileName: path.basename(page.fileName), absolutePath });
    }

    const safeTitle = (series?.title_primary || 'Chapter').replace(/[^a-zA-Z0-9_\-\. ]/g, '');
    const padNum = String(chapter.chapterNumber).padStart(3, '0');
    const filename = `${safeTitle} - c${padNum}.cbz`;

    const passThrough = new PassThrough();

    reply
      .header('Content-Type', 'application/vnd.comicbook+zip')
      .header('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`)
      .header('Cache-Control', 'no-cache');

    const streamer = new CbzArchiveStreamer(passThrough);
    streamer.streamChapterCbz({
      chapterId,
      metadata: {
        seriesTitle: series?.title_primary || safeTitle,
        chapterTitle: chapter.title,
        chapterNumber: chapter.chapterNumber,
        volumeNumber: chapter.volumeId ? parseInt(chapter.volumeId, 10) || null : null,
        summary: series?.synopsis || null,
        writer: series?.author || null,
        mangaReadingDirection: 'YesAndRightToLeft',
        pageCount: pages.length,
      },
      pages: pageItems,
    }).catch((err) => {
      passThrough.destroy(err);
    });

    return reply.send(passThrough);
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

    if (!body || typeof body.seriesSlug !== 'string' || !body.seriesSlug ||
        !Number.isSafeInteger(body.chapterNumber) || body.chapterNumber < 0 ||
        body.chapterNumber > 1_000_000 ||
        (body.volumeNumber !== undefined &&
          (!Number.isSafeInteger(body.volumeNumber) || body.volumeNumber < 0 || body.volumeNumber > 1_000_000)) ||
        typeof body.sourcePath !== 'string' || !body.sourcePath || body.sourcePath.length > 4096 ||
        (body.title !== undefined && (typeof body.title !== 'string' || body.title.length > 500)) ||
        (body.thermalSaver !== undefined && typeof body.thermalSaver !== 'boolean')) {
      reply.status(400);
      return {
        statusCode: 400,
        error: 'Bad Request',
        message: 'Missing required parameters: seriesSlug, chapterNumber, sourcePath',
      };
    }

    // Verify series exists in database
    const seriesStmt = db.prepare('SELECT id, slug FROM series WHERE slug = ?');
    const seriesRow = seriesStmt.get(body.seriesSlug) as any;
    if (!seriesRow) {
      reply.status(404);
      return {
        statusCode: 404,
        error: 'Not Found',
        message: `Series with slug '${body.seriesSlug}' does not exist in catalog`,
      };
    }

    let sourcePath = body.sourcePath;
    if (!fs.existsSync(sourcePath)) {
      const candidate = path.resolve(incomingRoot, body.sourcePath);
      if (fs.existsSync(candidate)) {
        sourcePath = candidate;
      } else {
        reply.status(400);
        return { statusCode: 400, error: 'Bad Request', message: 'Source must be an existing file or folder inside the configured incoming directory' };
      }
    }

    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,150}$/.test(seriesRow.slug) ||
        seriesRow.slug === '.' || seriesRow.slug === '..') {
      reply.status(409);
      return { statusCode: 409, error: 'Conflict', message: 'Series has an invalid storage slug' };
    }

    try {
      const ingestResult = await ingestChapter({
        storageRoot,
        seriesSlug: seriesRow.slug,
        volumeNumber: body.volumeNumber ?? 1,
        chapterNumber: body.chapterNumber,
        sourcePath,
        thermalSaver: body.thermalSaver,
      });

      const chapterId = `${body.seriesSlug}-c${body.chapterNumber}`;
      let transactionStarted = false;
      try {
        db.exec('BEGIN IMMEDIATE;');
        transactionStarted = true;
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
        db.exec('COMMIT;');
        transactionStarted = false;
      } catch (error) {
        if (transactionStarted) {
          try { db.exec('ROLLBACK;'); } catch { /* Preserve the original failure. */ }
        }
        await fs.promises.rm(ingestResult.absoluteStorageDir, { recursive: true, force: true });
        throw error;
      }

      return {
        success: true,
        chapterId,
        pageCount: ingestResult.pageCount,
        storagePath: ingestResult.relativeStorageDir,
        totalBytes: ingestResult.totalBytes,
      };
    } catch (err: any) {
      console.error('[chapter-ingest] failed:', err);
      reply.status(400);
      return {
        statusCode: 400,
        error: 'Bad Request',
        message: err.message || 'Chapter ingestion failed',
      };
    }
  });
}
