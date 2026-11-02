/**
 * KuraScroll Dialogue Search Fastify Routes
 * Sprint 60 - In-Manga Quote & Dialogue OCR Substring Search Endpoints
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  DialogueSearchService,
  DialogueBubbleInput,
} from '../services/dialogue-search-service.js';

export interface DialogueSearchRoutesOptions {
  db: DatabaseInstance;
  dialogueService?: DialogueSearchService;
}

export const dialogueSearchRoutes: FastifyPluginAsync<DialogueSearchRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: DialogueSearchRoutesOptions
) => {
  const service = opts.dialogueService ?? new DialogueSearchService(opts.db);

  /**
   * GET /api/v1/dialogue/search
   * High-speed substring dialogue query with anti-spoiler causal progress filters
   */
  fastify.get<{
    Querystring: {
      q?: string;
      seriesId?: string;
      chapterId?: string;
      maxChapter?: string | number;
      limit?: string | number;
      offset?: string | number;
    };
  }>('/api/v1/dialogue/search', async (request, reply) => {
    const { q, seriesId, chapterId, maxChapter, limit, offset } = request.query;

    if (!q || !q.trim()) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Query parameter "q" is required and cannot be empty',
      });
    }

    const maxChapterNumber =
      maxChapter !== undefined
        ? typeof maxChapter === 'string'
          ? parseFloat(maxChapter)
          : maxChapter
        : undefined;

    const limitNum =
      limit !== undefined
        ? typeof limit === 'string'
          ? parseInt(limit, 10)
          : limit
        : 20;

    const offsetNum =
      offset !== undefined
        ? typeof offset === 'string'
          ? parseInt(offset, 10)
          : offset
        : 0;

    const searchRes = service.search({
      query: q,
      seriesId,
      chapterId,
      maxChapterNumber,
      limit: limitNum,
      offset: offsetNum,
    });

    return reply.status(200).send({
      success: true,
      query: q,
      count: searchRes.total,
      queryTimeMs: searchRes.queryTimeMs,
      results: searchRes.results,
    });
  });

  /**
   * POST /api/v1/dialogue/index-batch
   * Ingest and index a batch of OCR dialogue bubbles
   */
  fastify.post<{
    Body: {
      bubbles: DialogueBubbleInput[];
    };
  }>('/api/v1/dialogue/index-batch', async (request, reply) => {
    const bubbles = request.body?.bubbles;

    if (!Array.isArray(bubbles) || bubbles.length === 0) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Body must contain a non-empty "bubbles" array',
      });
    }

    const insertedCount = service.indexBatch(bubbles);

    return reply.status(200).send({
      success: true,
      indexedCount: insertedCount,
    });
  });

  /**
   * POST /api/v1/dialogue/optimize
   * Maintenance route to merge FTS5 b-tree segments
   */
  fastify.post('/api/v1/dialogue/optimize', async (request, reply) => {
    service.optimizeFtsIndex();
    return reply.status(200).send({
      success: true,
      message: 'Dialogue FTS5 index optimized',
    });
  });

  /**
   * GET /api/v1/dialogue/stats
   * Telemetry stats for dialogue index
   */
  fastify.get('/api/v1/dialogue/stats', async (request, reply) => {
    const total = service.getTotalCount();
    return reply.status(200).send({
      success: true,
      totalIndexedBubbles: total,
    });
  });
};
