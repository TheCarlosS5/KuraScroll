/**
 * KuraScroll Intelligent Chapter Transition Pre-Baking Fastify Routes
 * Sprint 79 - Zero-Latency Chapter Flip & Continuous Visual Curtain
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  ChapterTransitionService,
  ChapterTransitionProfile,
  TransitionStyle,
  TransitionStateInput,
} from '../services/chapter-transition-service.js';
import crypto from 'node:crypto';

export interface ChapterTransitionRoutesOptions {
  db: DatabaseInstance;
  chapterTransitionService?: ChapterTransitionService;
}

export const chapterTransitionRoutes: FastifyPluginAsync<ChapterTransitionRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: ChapterTransitionRoutesOptions
) => {
  const service = opts.chapterTransitionService ?? new ChapterTransitionService(opts.db);

  /**
   * GET /api/v1/transition/profile/:seriesId
   * Retrieves active transition profile for a series or chapter with ETag caching
   */
  fastify.get<{
    Params: { seriesId: string };
    Querystring: { fromChapterId?: string };
  }>('/api/v1/transition/profile/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;
    const { fromChapterId } = request.query;

    if (!seriesId || seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid seriesId parameter',
      });
    }

    const profile = service.getProfile(seriesId, fromChapterId);
    const payload = JSON.stringify({ success: true, profile });
    const etag = `"${crypto.createHash('md5').update(payload).digest('hex')}"`;

    if (request.headers['if-none-match'] === etag) {
      return reply.status(304).send();
    }

    reply.header('Cache-Control', 'private, max-age=60, must-revalidate');
    reply.header('ETag', etag);
    return reply.status(200).type('application/json').send(payload);
  });

  /**
   * POST /api/v1/transition/profile
   * Saves or updates a chapter transition profile
   */
  fastify.post<{
    Body: {
      seriesId: string;
      fromChapterId?: string | null;
      toChapterId?: string | null;
      prebakeTriggerPageOffset?: number;
      transitionStyle?: TransitionStyle;
      autoAdvanceDelayMs?: number;
      showReadingSummary?: boolean;
      isEnabled?: boolean;
    };
  }>('/api/v1/transition/profile', async (request, reply) => {
    const body = request.body;

    if (!body || !body.seriesId || body.seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'seriesId is required',
      });
    }

    const saved = service.upsertProfile({
      seriesId: body.seriesId,
      fromChapterId: body.fromChapterId ?? null,
      toChapterId: body.toChapterId ?? null,
      prebakeTriggerPageOffset: body.prebakeTriggerPageOffset ?? 3,
      transitionStyle: body.transitionStyle ?? 'curtain',
      autoAdvanceDelayMs: body.autoAdvanceDelayMs ?? 1500,
      showReadingSummary: body.showReadingSummary !== false,
      isEnabled: body.isEnabled !== false,
    });

    return reply.status(200).send({ success: true, profile: saved });
  });

  /**
   * POST /api/v1/transition/resolve-state
   * Fast chapter transition state resolution (SLA 43 < 20µs)
   */
  fastify.post<{
    Body: TransitionStateInput;
  }>('/api/v1/transition/resolve-state', async (request, reply) => {
    const body = request.body;

    if (!body || typeof body.currentPage !== 'number' || typeof body.totalPages !== 'number') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'currentPage and totalPages are required numbers',
      });
    }

    const result = ChapterTransitionService.resolveTransitionState(body);

    return reply.status(200).send({
      success: true,
      result,
    });
  });
};
