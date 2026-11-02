/**
 * KuraScroll - Sprint 98: Predictive Intelligent Pre-Reading Micro-Heatmap Dwell Predictor Fastify Routes
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  ReadingDwellService,
  ReadingDwellProfile,
  PredictionMode,
  READING_DWELL_PRESETS,
} from '../services/reading-dwell-service.js';

export interface ReadingDwellRoutesOptions {
  db: DatabaseInstance;
  readingDwellService?: ReadingDwellService;
}

export function computeReadingDwellEtag(
  seriesId: string,
  predictionMode: string,
  baseDwellMs: number,
  complexityWeight: number,
  urgencyThresholdMs: number,
  isPrefetchTriggerEnabled: boolean,
  isEnabled: boolean,
  updatedAt: number
): string {
  return `"rd-${seriesId}-${predictionMode}-${baseDwellMs}-${complexityWeight}-${urgencyThresholdMs}-${isPrefetchTriggerEnabled ? 1 : 0}-${isEnabled ? 1 : 0}-${updatedAt}"`;
}

export const readingDwellRoutes: FastifyPluginAsync<ReadingDwellRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: ReadingDwellRoutesOptions
) => {
  const service = opts.readingDwellService ?? new ReadingDwellService(opts.db);

  /**
   * GET /api/v1/reader/reading-dwell/profile/:seriesId
   * Retrieves active profile with ETag caching
   */
  fastify.get<{
    Params: { seriesId: string };
  }>('/api/v1/reader/reading-dwell/profile/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;

    if (!seriesId || seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid or missing seriesId parameter',
      });
    }

    const profile = service.getProfile(seriesId);
    const etag = computeReadingDwellEtag(
      profile.seriesId,
      profile.predictionMode,
      profile.baseDwellMs,
      profile.complexityWeight,
      profile.urgencyThresholdMs,
      profile.isPrefetchTriggerEnabled,
      profile.isEnabled,
      profile.updatedAt
    );

    const clientEtag = request.headers['if-none-match'];
    if (clientEtag && clientEtag === etag) {
      return reply.status(304).send();
    }

    return reply
      .header('ETag', etag)
      .header('Cache-Control', 'private, no-cache')
      .status(200)
      .send({
        success: true,
        profile,
      });
  });

  /**
   * POST /api/v1/reader/reading-dwell/profile
   * Saves or updates reading dwell profile
   */
  fastify.post<{
    Body: {
      seriesId: string;
      predictionMode?: PredictionMode;
      baseDwellMs?: number;
      complexityWeight?: number;
      urgencyThresholdMs?: number;
      isPrefetchTriggerEnabled?: boolean;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/reading-dwell/profile', async (request, reply) => {
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
      predictionMode: body.predictionMode ?? current.predictionMode,
      baseDwellMs: body.baseDwellMs ?? current.baseDwellMs,
      complexityWeight: body.complexityWeight ?? current.complexityWeight,
      urgencyThresholdMs: body.urgencyThresholdMs ?? current.urgencyThresholdMs,
      isPrefetchTriggerEnabled: body.isPrefetchTriggerEnabled !== undefined ? body.isPrefetchTriggerEnabled : current.isPrefetchTriggerEnabled,
      isEnabled: body.isEnabled !== undefined ? body.isEnabled : current.isEnabled,
      updatedAt: Date.now(),
    });

    return reply.status(200).send({ success: true, profile: updated });
  });

  /**
   * POST /api/v1/reader/reading-dwell/calculate-prediction
   * Evaluates dwell prediction & prefetch trigger in sub-20 microseconds
   */
  fastify.post<{
    Body: {
      elapsedMs?: number;
      baseDwellMs?: number;
      complexityWeight?: number;
      urgencyThresholdMs?: number;
      mode?: PredictionMode;
    };
  }>('/api/v1/reader/reading-dwell/calculate-prediction', async (request, reply) => {
    const {
      elapsedMs,
      baseDwellMs,
      complexityWeight,
      urgencyThresholdMs,
      mode,
    } = request.body || {};

    const result = service.calculateDwellPrediction(
      elapsedMs ?? 0,
      baseDwellMs ?? 4500,
      complexityWeight ?? 1.25,
      urgencyThresholdMs ?? 800,
      mode ?? 'cadence_adaptive'
    );

    return reply.status(200).send({ success: true, result });
  });

  /**
   * GET /api/v1/reader/reading-dwell/presets
   * Lists predefined reading dwell configurations
   */
  fastify.get('/api/v1/reader/reading-dwell/presets', async (_request, reply) => {
    return reply.status(200).send({
      success: true,
      presets: READING_DWELL_PRESETS,
    });
  });
};
