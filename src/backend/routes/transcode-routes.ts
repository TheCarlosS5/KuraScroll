/**
 * Sprint 58 - Fastify Routes for Smart WebP Transcoding & Resolution Delivery
 */

import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fs from 'node:fs';
import { TranscodeCacheService, snapToValidTier } from '../services/transcode-cache-service.js';
import { DatabaseInstance } from '../db/database.js';

export interface TranscodeRoutesOptions {
  db: DatabaseInstance;
  transcodeCacheService: TranscodeCacheService;
}

export const transcodeRoutes: FastifyPluginAsync<TranscodeRoutesOptions> = async (
  fastify: FastifyInstance,
  options: TranscodeRoutesOptions
) => {
  const { db, transcodeCacheService } = options;

  // Helper to fetch chapter storage path
  const getChapterStoragePath = (chapterId: string): string | null => {
    const row = db.prepare('SELECT storage_path FROM chapters WHERE id = ?').get(chapterId) as any;
    return row?.storage_path || null;
  };

  // GET /api/v1/chapters/:chapterId/pages/:pageNumber/transcode
  fastify.get(
    '/api/v1/chapters/:chapterId/pages/:pageNumber/transcode',
    async (
      request: FastifyRequest<{
        Params: { chapterId: string; pageNumber: string };
        Querystring: { w?: string; q?: string };
        Headers: { 'if-none-match'?: string };
      }>,
      reply: FastifyReply
    ) => {
      const { chapterId, pageNumber } = request.params;
      const pageNum = Number.parseInt(pageNumber, 10);
      if (Number.isNaN(pageNum) || pageNum < 1) {
        return reply.status(400).send({
          success: false,
          error: 'INVALID_PAGE_NUMBER',
          message: 'Page number must be a positive integer',
        });
      }

      const requestedWidth = request.query.w ? Number.parseInt(request.query.w, 10) : 1200;
      const targetWidth = snapToValidTier(requestedWidth);

      // 1. Check if cached page already exists
      const cached = transcodeCacheService.lookupCachedPage(chapterId, pageNum, targetWidth);
      if (cached && fs.existsSync(cached.filePath)) {
        transcodeCacheService.touchPageAccess(chapterId, pageNum, targetWidth);

        // HTTP 304 Not Modified validation
        const clientEtag = request.headers['if-none-match'];
        if (clientEtag && clientEtag === cached.etag) {
          reply.header('ETag', cached.etag);
          reply.header('Cache-Control', 'public, max-age=31536000, immutable');
          return reply.status(304).send();
        }

        // Cache HIT: Stream transcoded WebP directly from disk
        reply.header('Content-Type', 'image/webp');
        reply.header('ETag', cached.etag);
        reply.header('Cache-Control', 'public, max-age=31536000, immutable');
        reply.header('X-Kura-Transcode-Cache', 'HIT');
        reply.header('Content-Length', cached.fileSizeBytes);

        return reply.status(200).send(fs.createReadStream(cached.filePath));
      }

      // 2. Cache MISS: Verify chapter exists
      const archivePath = getChapterStoragePath(chapterId);
      if (!archivePath || !fs.existsSync(archivePath)) {
        return reply.status(404).send({
          success: false,
          error: 'CHAPTER_NOT_FOUND',
          message: `Chapter with id '${chapterId}' does not exist on disk`,
        });
      }

      // In real workflow, source input is extracted from archive or filesystem
      try {
        // If the chapter storage_path is directly an image file or directory
        const stat = fs.statSync(archivePath);
        let sourceInput: string | Buffer = archivePath;

        if (stat.isDirectory()) {
          const pageFiles = fs.readdirSync(archivePath).sort();
          if (pageNum > pageFiles.length) {
            return reply.status(404).send({
              success: false,
              error: 'PAGE_NOT_FOUND',
              message: `Page ${pageNum} not found in chapter`,
            });
          }
          sourceInput = `${archivePath}/${pageFiles[pageNum - 1]}`;
        }

        const freshRecord = await transcodeCacheService.getOrTranscode(
          chapterId,
          pageNum,
          sourceInput,
          { width: targetWidth }
        );

        reply.header('Content-Type', 'image/webp');
        reply.header('ETag', freshRecord.etag);
        reply.header('Cache-Control', 'public, max-age=31536000, immutable');
        reply.header('X-Kura-Transcode-Cache', 'MISS');
        reply.header('Content-Length', freshRecord.fileSizeBytes);

        return reply.status(200).send(fs.createReadStream(freshRecord.filePath));
      } catch (err: any) {
        request.log.error(err, 'Failed to transcode page');
        return reply.status(500).send({
          success: false,
          error: 'TRANSCODE_ERROR',
          message: err.message || 'Error transcoding page to WebP',
        });
      }
    }
  );

  // GET /api/v1/cache/transcode/stats
  fastify.get('/api/v1/cache/transcode/stats', async () => {
    return {
      success: true,
      data: transcodeCacheService.getStats(),
    };
  });

  // POST /api/v1/cache/transcode/prune
  fastify.post('/api/v1/cache/transcode/prune', async () => {
    const result = await transcodeCacheService.pruneCacheIfNeeded();
    return {
      success: true,
      data: result,
    };
  });
};
