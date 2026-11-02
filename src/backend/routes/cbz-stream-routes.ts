/**
 * Sprint 57 - Fastify Routes for Zero-Seek CBZ Page Streaming
 */

import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { CbzStreamService } from '../services/cbz-stream-service.js';
import { DatabaseInstance } from '../db/database.js';

export interface CbzStreamRoutesOptions {
  db: DatabaseInstance;
  cbzStreamService: CbzStreamService;
}

export const cbzStreamRoutes: FastifyPluginAsync<CbzStreamRoutesOptions> = async (
  fastify: FastifyInstance,
  options: CbzStreamRoutesOptions
) => {
  const { db, cbzStreamService } = options;

  // Helper to fetch chapter storage path
  const getChapterStoragePath = (chapterId: string): string | null => {
    const row = db.prepare('SELECT storage_path FROM chapters WHERE id = ?').get(chapterId) as any;
    return row?.storage_path || null;
  };

  // GET /api/v1/chapters/:chapterId/pages/:pageNumber/stream
  fastify.get(
    '/api/v1/chapters/:chapterId/pages/:pageNumber/stream',
    async (
      request: FastifyRequest<{
        Params: { chapterId: string; pageNumber: string };
        Headers: { range?: string };
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

      const archivePath = getChapterStoragePath(chapterId);
      if (!archivePath) {
        return reply.status(404).send({
          success: false,
          error: 'CHAPTER_NOT_FOUND',
          message: `Chapter with id '${chapterId}' does not exist`,
        });
      }

      try {
        const result = cbzStreamService.createPageStream(
          chapterId,
          archivePath,
          pageNum,
          request.headers.range
        );

        for (const [key, val] of Object.entries(result.headers)) {
          reply.header(key, val);
        }

        return reply.status(result.statusCode).send(result.stream);
      } catch (err: any) {
        if (err.statusCode === 416) {
          reply.header('Content-Range', err.contentRange);
          return reply.status(416).send({
            success: false,
            error: 'RANGE_NOT_SATISFIABLE',
          });
        }

        if (err.message && err.message.includes('not found in chapter')) {
          return reply.status(404).send({
            success: false,
            error: 'PAGE_NOT_FOUND',
            message: err.message,
          });
        }

        request.log.error(err, 'Failed to stream CBZ page');
        return reply.status(500).send({
          success: false,
          error: 'STREAM_ERROR',
          message: err.message || 'Internal streaming error',
        });
      }
    }
  );

  // GET /api/v1/chapters/:chapterId/offsets
  fastify.get(
    '/api/v1/chapters/:chapterId/offsets',
    async (
      request: FastifyRequest<{ Params: { chapterId: string } }>,
      reply: FastifyReply
    ) => {
      const { chapterId } = request.params;
      const offsets = cbzStreamService.getChapterOffsets(chapterId);

      return reply.status(200).send({
        success: true,
        data: offsets,
      });
    }
  );

  // GET /api/v1/chapters/:chapterId/clusters
  fastify.get(
    '/api/v1/chapters/:chapterId/clusters',
    async (
      request: FastifyRequest<{
        Params: { chapterId: string };
        Querystring: { maxGap?: string; maxWindow?: string };
      }>,
      reply: FastifyReply
    ) => {
      const { chapterId } = request.params;
      const maxGap = request.query.maxGap ? Number.parseInt(request.query.maxGap, 10) : undefined;
      const maxWindow = request.query.maxWindow ? Number.parseInt(request.query.maxWindow, 10) : undefined;

      const clusters = cbzStreamService.getSequentialClusters(chapterId, maxGap, maxWindow);
      return reply.status(200).send({
        success: true,
        data: clusters,
      });
    }
  );
};
