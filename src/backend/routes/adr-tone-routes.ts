/**
 * KuraScroll - Sprint 123: Adaptive Dynamic Range (ADR) Tone Equalizer & Black-Crush Compensator Routes
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  ADRToneService,
  ADRPresetName,
  calculateADRTone,
  ADR_TONE_PRESETS,
} from '../services/adr-tone-service.js';

export interface ADRToneRoutesOptions {
  db: DatabaseInstance;
  adrToneService?: ADRToneService;
}

export function computeADRToneEtag(
  seriesId: string,
  presetName: string,
  shadowLift: number,
  gamma: number,
  shoulderClamp: number,
  whitePoint: number,
  isEnabled: boolean,
  updatedAt: number
): string {
  return `"at-${seriesId}-${presetName}-${shadowLift}-${gamma}-${shoulderClamp}-${whitePoint}-${isEnabled ? 1 : 0}-${updatedAt}"`;
}

export const adrToneRoutes: FastifyPluginAsync<ADRToneRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: ADRToneRoutesOptions
) => {
  const service = opts.adrToneService ?? new ADRToneService(opts.db);

  /**
   * GET /api/v1/reader/adr-tone/presets
   * Retrieves all available ADR tone mapping presets
   */
  fastify.get('/api/v1/reader/adr-tone/presets', async (_request, reply) => {
    return reply.status(200).send({
      success: true,
      presets: ADR_TONE_PRESETS,
    });
  });

  /**
   * GET /api/v1/reader/adr-tone/profile/:seriesId
   * Retrieves active profile with ETag caching
   */
  fastify.get<{
    Params: { seriesId: string };
  }>('/api/v1/reader/adr-tone/profile/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;

    if (!seriesId || seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid or missing seriesId parameter',
      });
    }

    const profile = service.getProfile(seriesId);
    const etag = computeADRToneEtag(
      profile.seriesId,
      profile.presetName,
      profile.shadowLift,
      profile.gamma,
      profile.shoulderClamp,
      profile.whitePoint,
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
   * POST /api/v1/reader/adr-tone/profile
   * Saves or updates ADR tone profile
   */
  fastify.post<{
    Body: {
      seriesId: string;
      presetName?: ADRPresetName;
      shadowLift?: number;
      gamma?: number;
      shoulderClamp?: number;
      whitePoint?: number;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/adr-tone/profile', async (request, reply) => {
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
      presetName: body.presetName,
      shadowLift: body.shadowLift,
      gamma: body.gamma,
      shoulderClamp: body.shoulderClamp,
      whitePoint: body.whitePoint,
      isEnabled: body.isEnabled,
    });

    return reply.status(200).send({ success: true, profile: updated });
  });

  /**
   * POST /api/v1/reader/adr-tone/calculate
   * Real-time zero-allocation piecewise tone curve calculation
   */
  fastify.post<{
    Body: {
      luminance: number;
      shadowLift?: number;
      gamma?: number;
      shoulderClamp?: number;
      whitePoint?: number;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/adr-tone/calculate', async (request, reply) => {
    const { luminance, shadowLift, gamma, shoulderClamp, whitePoint, isEnabled } =
      request.body ?? {};

    if (luminance === undefined) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Missing required luminance parameter',
      });
    }

    const result = calculateADRTone(
      luminance,
      shadowLift,
      gamma,
      shoulderClamp,
      whitePoint,
      isEnabled
    );

    return reply.status(200).send({
      success: true,
      result,
    });
  });
};
