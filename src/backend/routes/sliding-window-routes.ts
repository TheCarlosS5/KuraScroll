/**
 * KuraScroll Continuous Page In-Viewport Micro-Cache & Sliding Window Fastify Routes
 * Sprint 86 - SlidingWindow Micro-Cache Engine
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  SlidingWindowService,
  SlidingWindowProfile,
  SlidingWindowMode,
  SLIDING_WINDOW_MODES,
} from '../services/sliding-window-service.js';

export interface SlidingWindowRoutesOptions {
  db: DatabaseInstance;
  slidingWindowService?: SlidingWindowService;
}

export function computeSlidingWindowEtag(
  seriesId: string,
  windowSize: number,
  forwardBuffer: number,
  backwardBuffer: number,
  evictStrategy: string,
  isEnabled: boolean,
  updatedAt: number
): string {
  return `"sw-${seriesId}-${windowSize}-${forwardBuffer}-${backwardBuffer}-${evictStrategy}-${isEnabled ? 1 : 0}-${updatedAt}"`;
}

export const slidingWindowRoutes: FastifyPluginAsync<SlidingWindowRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: SlidingWindowRoutesOptions
) => {
  const service = opts.slidingWindowService ?? new SlidingWindowService(opts.db);

  /**
   * GET /api/v1/reader/sliding-window/profile/:seriesId
   * Retrieves active sliding window profile with ETag caching
   */
  fastify.get<{
    Params: { seriesId: string };
  }>('/api/v1/reader/sliding-window/profile/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;

    if (!seriesId || seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid seriesId parameter',
      });
    }

    const profile = service.getProfile(seriesId);
    const etag = computeSlidingWindowEtag(
      profile.seriesId,
      profile.windowSize,
      profile.forwardBuffer,
      profile.backwardBuffer,
      profile.evictStrategy,
      profile.isEnabled,
      profile.updatedAt
    );

    if (request.headers['if-none-match'] === etag) {
      return reply.status(304).send();
    }

    reply.header('Cache-Control', 'private, max-age=60, must-revalidate');
    reply.header('ETag', etag);
    return reply.status(200).send({ success: true, profile });
  });

  /**
   * POST /api/v1/reader/sliding-window/profile
   * Saves or updates a sliding window profile
   */
  fastify.post<{
    Body: {
      seriesId: string;
      windowSize?: number;
      forwardBuffer?: number;
      backwardBuffer?: number;
      evictStrategy?: SlidingWindowMode;
      maxCachedBytes?: number;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/sliding-window/profile', async (request, reply) => {
    const body = request.body;
    if (!body || !body.seriesId || body.seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Missing or empty seriesId',
      });
    }

    const current = service.getProfile(body.seriesId);
    const updated = service.setProfile({
      seriesId: body.seriesId,
      windowSize: body.windowSize ?? current.windowSize,
      forwardBuffer: body.forwardBuffer ?? current.forwardBuffer,
      backwardBuffer: body.backwardBuffer ?? current.backwardBuffer,
      evictStrategy: body.evictStrategy ?? current.evictStrategy,
      maxCachedBytes: body.maxCachedBytes ?? current.maxCachedBytes,
      isEnabled: body.isEnabled !== undefined ? body.isEnabled : current.isEnabled,
      updatedAt: Date.now(),
    });

    return reply.status(200).send({ success: true, profile: updated });
  });

  /**
   * POST /api/v1/reader/sliding-window/calculate-indices
   * Calculates sliding window indices in sub-20 microseconds
   */
  fastify.post<{
    Body: {
      totalCount: number;
      currentIndex: number;
      forwardBuffer?: number;
      backwardBuffer?: number;
      bytesPerPage?: number;
    };
  }>('/api/v1/reader/sliding-window/calculate-indices', async (request, reply) => {
    const { totalCount, currentIndex, forwardBuffer, backwardBuffer, bytesPerPage } = request.body || {};

    if (totalCount === undefined || currentIndex === undefined) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Missing totalCount or currentIndex',
      });
    }

    const result = service.calculateSlidingWindow(
      totalCount,
      currentIndex,
      forwardBuffer ?? 3,
      backwardBuffer ?? 2,
      bytesPerPage ?? 2621440
    );

    return reply.status(200).send({ success: true, result });
  });

  /**
   * GET /api/v1/reader/sliding-window/modes
   * Lists predefined sliding window buffering presets
   */
  fastify.get('/api/v1/reader/sliding-window/modes', async (_request, reply) => {
    return reply.status(200).send({
      success: true,
      modes: SLIDING_WINDOW_MODES,
    });
  });
};
