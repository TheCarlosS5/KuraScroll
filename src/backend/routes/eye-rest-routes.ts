/**
 * KuraScroll - Sprint 104: Eye Rest Fastify Routes
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  EyeRestService,
  EyeRestProfile,
  ShutterMode,
  AnchorPoint,
  Viewport,
  calculateEyeRestAperture,
  EYE_REST_PRESETS,
} from '../services/eye-rest-service.js';

export interface EyeRestRoutesOptions {
  db: DatabaseInstance;
  eyeRestService?: EyeRestService;
}

export function computeEyeRestEtag(
  seriesId: string,
  shutterMode: string,
  apertureRadiusPx: number,
  falloffPct: number,
  restIntervalMin: number,
  eyeCareWarmthK: number,
  isEnabled: boolean,
  updatedAt: number
): string {
  return `"er-${seriesId}-${shutterMode}-${apertureRadiusPx}-${falloffPct}-${restIntervalMin}-${eyeCareWarmthK}-${isEnabled ? 1 : 0}-${updatedAt}"`;
}

export const eyeRestRoutes: FastifyPluginAsync<EyeRestRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: EyeRestRoutesOptions
) => {
  const service = opts.eyeRestService ?? new EyeRestService(opts.db);

  /**
   * GET /api/v1/reader/eye-rest/profile/:seriesId
   * Retrieves active profile with ETag caching
   */
  fastify.get<{
    Params: { seriesId: string };
  }>('/api/v1/reader/eye-rest/profile/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;

    if (!seriesId || seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid or missing seriesId parameter',
      });
    }

    const profile = service.getProfile(seriesId);
    const etag = computeEyeRestEtag(
      profile.seriesId,
      profile.shutterMode,
      profile.apertureRadiusPx,
      profile.falloffPct,
      profile.restIntervalMin,
      profile.eyeCareWarmthK,
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
   * POST /api/v1/reader/eye-rest/profile
   * Saves or updates eye-rest profile
   */
  fastify.post<{
    Body: {
      seriesId: string;
      shutterMode?: ShutterMode;
      apertureRadiusPx?: number;
      falloffPct?: number;
      restIntervalMin?: number;
      eyeCareWarmthK?: number;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/eye-rest/profile', async (request, reply) => {
    const body = request.body;
    if (!body || !body.seriesId || body.seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Missing or empty seriesId',
      });
    }

    const updated = service.upsertProfile({
      seriesId: body.seriesId,
      shutterMode: body.shutterMode,
      apertureRadiusPx: body.apertureRadiusPx,
      falloffPct: body.falloffPct,
      restIntervalMin: body.restIntervalMin,
      eyeCareWarmthK: body.eyeCareWarmthK,
      isEnabled: body.isEnabled,
    });

    return reply.status(200).send({ success: true, profile: updated });
  });

  /**
   * POST /api/v1/reader/eye-rest/calculate-aperture
   * Real-time zero-allocation aperture mask calculation
   */
  fastify.post<{
    Body: {
      anchor?: AnchorPoint;
      viewport?: Viewport;
      apertureRadiusPx?: number;
      falloffPct?: number;
      elapsedReadingMin?: number;
      restIntervalMin?: number;
      eyeCareWarmthK?: number;
      mode?: ShutterMode;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/eye-rest/calculate-aperture', async (request, reply) => {
    const body = request.body ?? {};

    const result = calculateEyeRestAperture(
      body.anchor ?? { x: 640, y: 360 },
      body.viewport ?? { width: 1280, height: 720 },
      body.apertureRadiusPx ?? 320,
      body.falloffPct ?? 35,
      body.elapsedReadingMin ?? 0,
      body.restIntervalMin ?? 20,
      body.eyeCareWarmthK ?? 3200,
      body.mode ?? 'subtle_vignette',
      body.isEnabled ?? true
    );

    return reply.status(200).send({
      success: true,
      result,
    });
  });

  /**
   * GET /api/v1/reader/eye-rest/presets
   * Retrieves predefined eye-rest presets
   */
  fastify.get('/api/v1/reader/eye-rest/presets', async (_request, reply) => {
    return reply.status(200).send({
      success: true,
      presets: service.getPresets(),
    });
  });
};
