/**
 * KuraScroll Deduplication & Series Reconciliation Routes
 * Fastify endpoints for catalog duplicate review and atomic merges
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DuplicateDetectorService } from '../services/duplicate-detector-service.js';
import { DatabaseInstance } from '../db/database.js';

interface DedupRoutesOptions {
  db: DatabaseInstance;
}

export const dedupRoutes: FastifyPluginAsync<DedupRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: DedupRoutesOptions
) => {
  const service = new DuplicateDetectorService(opts.db);

  // List candidate duplicates
  fastify.get<{
    Querystring: { threshold?: string };
  }>('/api/v1/admin/dedup/candidates', async (request, reply) => {
    const rawThreshold = request.query.threshold ? parseFloat(request.query.threshold) : 0.82;
    const threshold = Number.isNaN(rawThreshold) ? 0.82 : Math.max(0.5, Math.min(1.0, rawThreshold));

    const candidates = service.findDuplicateCandidates(threshold);
    return reply.send({
      success: true,
      count: candidates.length,
      threshold,
      candidates
    });
  });

  // Execute atomic transactional merge
  fastify.post<{
    Body: {
      sourceSeriesId: string;
      targetSeriesId: string;
      strategy?: 'KEEP_HIGHER_PAGE_COUNT' | 'KEEP_TARGET';
    };
  }>('/api/v1/admin/dedup/merge', async (request, reply) => {
    const { sourceSeriesId, targetSeriesId, strategy } = request.body || {};

    if (!sourceSeriesId || !targetSeriesId) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Missing sourceSeriesId or targetSeriesId'
      });
    }

    try {
      const result = service.mergeSeries(sourceSeriesId, targetSeriesId, strategy || 'KEEP_HIGHER_PAGE_COUNT');
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: err.message || 'Failed to merge series'
      });
    }
  });

  // Get merge audit history
  fastify.get('/api/v1/admin/dedup/history', async (_request, reply) => {
    const history = service.getMergeHistory();
    return reply.send({
      success: true,
      count: history.length,
      history
    });
  });
};
