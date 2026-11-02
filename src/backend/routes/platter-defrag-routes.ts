/**
 * KuraScroll Platter Defragmentation & Sequential CBZ Re-Ordering Routes
 * Sprint 63 - 4TB Mechanical SATA II HDD Lifespan & Radial Seek Latency Minimizer Endpoints
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  PlatterDefragService,
  PlatterLocalityReport,
  DefragOptimizationResult,
  DefragRunRecord,
} from '../services/platter-defrag-service.js';

export interface PlatterDefragRoutesOptions {
  db: DatabaseInstance;
  defragService?: PlatterDefragService;
}

export const platterDefragRoutes: FastifyPluginAsync<PlatterDefragRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: PlatterDefragRoutesOptions
) => {
  const service = opts.defragService ?? new PlatterDefragService(opts.db);

  /**
   * GET /api/v1/storage/platter/pli
   * Evaluates physical Platter Locality Index (PLI) for a series
   */
  fastify.get<{
    Querystring: {
      seriesId?: string;
    };
  }>('/api/v1/storage/platter/pli', async (request, reply) => {
    const { seriesId } = request.query;

    if (!seriesId || !seriesId.trim()) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Query parameter "seriesId" is required',
      });
    }

    try {
      const report: PlatterLocalityReport = service.calculateSeriesPli(seriesId);
      return reply.status(200).send({
        success: true,
        report,
      });
    } catch (err: any) {
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: err.message || 'Failed to calculate series PLI',
      });
    }
  });

  /**
   * POST /api/v1/storage/platter/optimize
   * Triggers sequential atomic 64KB-chunked zero-thrash cylinder reordering for chapters in a series
   */
  fastify.post<{
    Body: {
      seriesId?: string;
      maxChapters?: number;
    };
  }>('/api/v1/storage/platter/optimize', async (request, reply) => {
    const { seriesId, maxChapters } = request.body ?? {};

    if (!seriesId || !seriesId.trim()) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Body field "seriesId" is required',
      });
    }

    try {
      const result: DefragOptimizationResult = await service.optimizeSeriesPlatter(seriesId, {
        maxChapters,
      });

      return reply.status(200).send({
        success: true,
        result,
      });
    } catch (err: any) {
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: err.message || 'Failed to optimize platter locality',
      });
    }
  });

  /**
   * GET /api/v1/storage/platter/history
   * Retrieves past defragmentation audit runs
   */
  fastify.get<{
    Querystring: {
      seriesId?: string;
      limit?: string | number;
    };
  }>('/api/v1/storage/platter/history', async (request, reply) => {
    const { seriesId, limit } = request.query;

    const limitNum =
      limit !== undefined
        ? typeof limit === 'string'
          ? parseInt(limit, 10)
          : limit
        : 20;

    const runs: DefragRunRecord[] = service.getDefragHistory(seriesId || undefined, limitNum);

    return reply.status(200).send({
      success: true,
      count: runs.length,
      history: runs,
    });
  });

  /**
   * GET /api/v1/storage/platter/stats
   * Retrieves cumulative lifetime defragmentation metrics
   */
  fastify.get('/api/v1/storage/platter/stats', async (_request, reply) => {
    const stats = service.getStats();

    return reply.status(200).send({
      success: true,
      stats,
    });
  });
};
