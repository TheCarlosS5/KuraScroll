/**
 * KuraScroll Adaptive Contrast Dynamic Range & HDR Tone-Mapping Fastify Routes
 * Sprint 89 - DynamicTone Engine
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  DynamicToneService,
  DynamicToneProfile,
  AmbientAdaptationMode,
  DYNAMIC_TONE_MODES,
} from '../services/dynamic-tone-service.js';

export interface DynamicToneRoutesOptions {
  db: DatabaseInstance;
  dynamicToneService?: DynamicToneService;
}

export function computeDynamicToneEtag(
  seriesId: string,
  gammaExponent: number,
  blackPointLift: number,
  whitePointCompress: number,
  ambientAdaptationMode: string,
  isEnabled: boolean,
  updatedAt: number
): string {
  return `"dt-${seriesId}-${gammaExponent}-${blackPointLift}-${whitePointCompress}-${ambientAdaptationMode}-${isEnabled ? 1 : 0}-${updatedAt}"`;
}

export const dynamicToneRoutes: FastifyPluginAsync<DynamicToneRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: DynamicToneRoutesOptions
) => {
  const service = opts.dynamicToneService ?? new DynamicToneService(opts.db);

  /**
   * GET /api/v1/reader/dynamic-tone/profile/:seriesId
   * Retrieves active profile with ETag caching
   */
  fastify.get<{
    Params: { seriesId: string };
  }>('/api/v1/reader/dynamic-tone/profile/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;

    if (!seriesId || seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid seriesId parameter',
      });
    }

    const profile = service.getProfile(seriesId);
    const etag = computeDynamicToneEtag(
      profile.seriesId,
      profile.gammaExponent,
      profile.blackPointLift,
      profile.whitePointCompress,
      profile.ambientAdaptationMode,
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
   * POST /api/v1/reader/dynamic-tone/profile
   * Saves or updates a dynamic tone profile
   */
  fastify.post<{
    Body: {
      seriesId: string;
      gammaExponent?: number;
      blackPointLift?: number;
      whitePointCompress?: number;
      ambientAdaptationMode?: AmbientAdaptationMode;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/dynamic-tone/profile', async (request, reply) => {
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
      gammaExponent: body.gammaExponent ?? current.gammaExponent,
      blackPointLift: body.blackPointLift ?? current.blackPointLift,
      whitePointCompress: body.whitePointCompress ?? current.whitePointCompress,
      ambientAdaptationMode: body.ambientAdaptationMode ?? current.ambientAdaptationMode,
      isEnabled: body.isEnabled !== undefined ? body.isEnabled : current.isEnabled,
      updatedAt: Date.now(),
    });

    return reply.status(200).send({ success: true, profile: updated });
  });

  /**
   * POST /api/v1/reader/dynamic-tone/calculate-params
   * Calculates tone mapping CSS filter string in sub-20 microseconds
   */
  fastify.post<{
    Body: {
      gamma?: number;
      blackLift?: number;
      whiteCompress?: number;
      mode?: AmbientAdaptationMode;
    };
  }>('/api/v1/reader/dynamic-tone/calculate-params', async (request, reply) => {
    const { gamma, blackLift, whiteCompress, mode } = request.body || {};

    const result = service.calculateToneMappingParameters(
      gamma ?? 1.15,
      blackLift ?? 0.04,
      whiteCompress ?? 0.92,
      mode ?? 'cinema_night'
    );

    return reply.status(200).send({ success: true, result });
  });

  /**
   * GET /api/v1/reader/dynamic-tone/modes
   * Lists predefined ambient adaptation presets
   */
  fastify.get('/api/v1/reader/dynamic-tone/modes', async (_request, reply) => {
    return reply.status(200).send({
      success: true,
      modes: DYNAMIC_TONE_MODES,
    });
  });
};
