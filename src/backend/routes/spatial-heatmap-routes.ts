/**
 * KuraScroll Spatial Reading Heatmap Fastify Routes
 * Sprint 61 - High-Density Dwell Reconstruction & 2D Spatial Kernel Projection Endpoints
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  SpatialHeatmapService,
  SpatialBoundingBox,
  SpatialPoint,
  FocusElementType,
} from '../services/spatial-heatmap-service.js';

export interface SpatialHeatmapRoutesOptions {
  db: DatabaseInstance;
  spatialHeatmapService?: SpatialHeatmapService;
}

export const spatialHeatmapRoutes: FastifyPluginAsync<SpatialHeatmapRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: SpatialHeatmapRoutesOptions
) => {
  const service = opts.spatialHeatmapService ?? new SpatialHeatmapService(opts.db);

  /**
   * POST /api/v1/analytics/spatial-heatmap/record
   * Ingests reading fixation or kinetic gaze event into zero-allocation Float32Array accumulator
   */
  fastify.post<{
    Body: {
      chapterId: string;
      pageNumber: number;
      userId: string;
      dwellMs: number;
      focusType?: FocusElementType;
      boundingBox?: SpatialBoundingBox;
      point?: SpatialPoint;
    };
  }>('/api/v1/analytics/spatial-heatmap/record', async (request, reply) => {
    const { chapterId, pageNumber, userId, dwellMs, focusType, boundingBox, point } = request.body;

    if (!chapterId || typeof chapterId !== 'string') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Field "chapterId" is required',
      });
    }

    if (!pageNumber || typeof pageNumber !== 'number' || pageNumber < 1) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Field "pageNumber" must be an integer >= 1',
      });
    }

    if (!userId || typeof userId !== 'string') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Field "userId" is required',
      });
    }

    if (dwellMs === undefined || typeof dwellMs !== 'number' || dwellMs <= 0) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Field "dwellMs" must be a positive number',
      });
    }

    service.recordDwellEvent({
      chapterId,
      pageNumber,
      userId,
      dwellMs,
      focusType,
      boundingBox,
      point,
    });

    return reply.status(200).send({
      success: true,
      message: 'Spatial dwell event recorded in memory',
    });
  });

  /**
   * GET /api/v1/analytics/spatial-heatmap/page
   * Retrieves 16x16 spatial attention matrix for reader or community aggregate
   */
  fastify.get<{
    Querystring: {
      chapterId?: string;
      pageNumber?: string | number;
      userId?: string;
    };
  }>('/api/v1/analytics/spatial-heatmap/page', async (request, reply) => {
    const { chapterId, pageNumber, userId } = request.query;

    if (!chapterId || typeof chapterId !== 'string') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Query parameter "chapterId" is required',
      });
    }

    const pageNum =
      pageNumber !== undefined
        ? typeof pageNumber === 'string'
          ? parseInt(pageNumber, 10)
          : pageNumber
        : NaN;

    if (isNaN(pageNum) || pageNum < 1) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Query parameter "pageNumber" must be an integer >= 1',
      });
    }

    const heatmap = service.getPageHeatmap(chapterId, pageNum, userId);

    if (!heatmap) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: `No spatial heatmap data available for chapter ${chapterId} page ${pageNum}`,
      });
    }

    return reply.status(200).send({
      success: true,
      heatmap,
    });
  });

  /**
   * POST /api/v1/analytics/spatial-heatmap/flush
   * Explicitly flushes dirty in-memory heatmaps to SQLite (e.g. on chapter unload)
   */
  fastify.post<{
    Body?: {
      chapterId?: string;
      userId?: string;
    };
  }>('/api/v1/analytics/spatial-heatmap/flush', async (request, reply) => {
    const filter = request.body;
    const flushedCount = service.flushBuffer(filter);

    return reply.status(200).send({
      success: true,
      flushedCount,
      message: `Flushed ${flushedCount} spatial heatmaps to persistent storage`,
    });
  });

  /**
   * GET /api/v1/analytics/spatial-heatmap/stats
   * Returns in-memory accumulator diagnostics and RAM pressure metrics
   */
  fastify.get('/api/v1/analytics/spatial-heatmap/stats', async () => {
    const stats = service.getStats();
    return {
      success: true,
      stats,
    };
  });
};
