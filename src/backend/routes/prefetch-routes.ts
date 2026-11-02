/**
 * KuraScroll Predictive Prefetch & Cache Warmth Endpoints
 * Sprint 59 - Intelligent Pre-Flight Cache Warming & Turn-Ahead Prediction Routes
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  PredictivePrefetchDaemon,
  NavigationNotice,
  WarmthState,
} from '../services/predictive-prefetch-daemon.js';
import { ReadingMode } from '../utils/markov-direction-predictor.js';

export interface PrefetchRoutesOptions {
  db?: DatabaseInstance;
  prefetchDaemon?: PredictivePrefetchDaemon;
}

export const prefetchRoutes: FastifyPluginAsync<PrefetchRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: PrefetchRoutesOptions
) => {
  const daemon = opts.prefetchDaemon ?? new PredictivePrefetchDaemon();

  /**
   * POST /api/v1/prefetch/navigate
   * Reader client notifies page progression; triggers Markov prediction and speculative warming
   */
  fastify.post<{
    Body: {
      userId?: string;
      chapterId: string;
      pageNumber: number;
      previousPage?: number;
      dwellSeconds?: number;
      readingMode?: ReadingMode;
      isDoubleSpread?: boolean;
      totalPages?: number;
      nextChapterId?: string;
      prevChapterId?: string;
      targetWidth?: number;
    };
  }>('/api/v1/prefetch/navigate', async (request, reply) => {
    const body = request.body;
    if (!body || !body.chapterId || typeof body.pageNumber !== 'number') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'chapterId and numeric pageNumber are required',
      });
    }

    const notice: NavigationNotice = {
      userId: body.userId,
      chapterId: body.chapterId,
      pageNumber: body.pageNumber,
      previousPage: body.previousPage,
      dwellSeconds: body.dwellSeconds,
      readingMode: body.readingMode,
      isDoubleSpread: body.isDoubleSpread,
      totalPages: body.totalPages,
      nextChapterId: body.nextChapterId,
      prevChapterId: body.prevChapterId,
      targetWidth: body.targetWidth ?? 1200,
    };

    const result = await daemon.notifyNavigation(notice);

    return reply.status(200).send({
      success: true,
      candidates: result.candidates,
      probabilities: result.probabilities,
    });
  });

  /**
   * GET /api/v1/prefetch/warmth
   * Check warmth status of a specific chapter page and resolution tier
   */
  fastify.get<{
    Querystring: {
      chapterId: string;
      pageNumber: string | number;
      width?: string | number;
    };
  }>('/api/v1/prefetch/warmth', async (request, reply) => {
    const { chapterId, pageNumber, width } = request.query;

    if (!chapterId || pageNumber === undefined) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'chapterId and pageNumber are required query parameters',
      });
    }

    const pageNum = typeof pageNumber === 'string' ? parseInt(pageNumber, 10) : pageNumber;
    const targetWidth = width ? (typeof width === 'string' ? parseInt(width, 10) : width) : 1200;

    const warmth: WarmthState = daemon.getWarmth(chapterId, pageNum, targetWidth);

    return reply.status(200).send({
      chapterId,
      pageNumber: pageNum,
      width: targetWidth,
      warmth,
    });
  });

  /**
   * POST /api/v1/prefetch/mark-hot
   * Manually register that a page has been loaded into memory/cache
   */
  fastify.post<{
    Body: {
      chapterId: string;
      pageNumber: number;
      width?: number;
    };
  }>('/api/v1/prefetch/mark-hot', async (request, reply) => {
    const { chapterId, pageNumber, width } = request.body || {};

    if (!chapterId || typeof pageNumber !== 'number') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'chapterId and numeric pageNumber are required',
      });
    }

    const targetWidth = width ?? 1200;
    daemon.setWarmth(chapterId, pageNumber, targetWidth, 'hot');

    return reply.status(200).send({
      success: true,
      chapterId,
      pageNumber,
      width: targetWidth,
      warmth: 'hot',
    });
  });

  /**
   * GET /api/v1/prefetch/stats
   * Telemetry stats for active prefetch daemon
   */
  fastify.get('/api/v1/prefetch/stats', async (request, reply) => {
    const stats = daemon.getStats();
    return reply.status(200).send({
      success: true,
      stats,
    });
  });
};
