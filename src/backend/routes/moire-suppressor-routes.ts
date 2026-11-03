/**
 * KuraScroll - Sprint 127: Adaptive Moiré Pattern Suppressor & Halftone Screentone De-Aliasing Filter Routes
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  MoireSuppressorService,
  MoireSuppressorPresetName,
  MOIRE_SUPPRESSOR_PRESETS,
  calculateMoireSuppression,
} from '../services/moire-suppressor-service.js';

export interface MoireSuppressorRoutesOptions {
  db: DatabaseInstance;
  moireSuppressorService?: MoireSuppressorService;
}

export function computeMoireSuppressorEtag(
  seriesId: string,
  presetName: string,
  suppressionStrength: number,
  deltaClamp: number,
  edgeThreshold: number,
  filterRadius: number,
  isEnabled: boolean,
  updatedAt: number
): string {
  return `"ms-${seriesId}-${presetName}-${suppressionStrength}-${deltaClamp}-${edgeThreshold}-${filterRadius}-${isEnabled ? 1 : 0}-${updatedAt}"`;
}

export const moireSuppressorRoutes: FastifyPluginAsync<MoireSuppressorRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: MoireSuppressorRoutesOptions
) => {
  const service = opts.moireSuppressorService ?? new MoireSuppressorService(opts.db);

  /**
   * GET /api/v1/reader/moire-suppressor/presets
   */
  fastify.get('/api/v1/reader/moire-suppressor/presets', async (_request, reply) => {
    return reply.status(200).send({
      success: true,
      presets: MOIRE_SUPPRESSOR_PRESETS,
    });
  });

  /**
   * GET /api/v1/reader/moire-suppressor/profile/:seriesId
   */
  fastify.get<{
    Params: { seriesId: string };
  }>('/api/v1/reader/moire-suppressor/profile/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;

    if (!seriesId || seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid or missing seriesId parameter',
      });
    }

    const profile = service.getProfile(seriesId);
    const etag = computeMoireSuppressorEtag(
      profile.seriesId,
      profile.presetName,
      profile.suppressionStrength,
      profile.deltaClamp,
      profile.edgeThreshold,
      profile.filterRadius,
      profile.isEnabled,
      profile.updatedAt
    );

    if (request.headers['if-none-match'] === etag) {
      return reply.status(304).send();
    }

    reply.header('ETag', etag);
    reply.header('Cache-Control', 'private, no-cache');
    return reply.status(200).send({
      success: true,
      profile,
    });
  });

  /**
   * PUT /api/v1/reader/moire-suppressor/profile/:seriesId
   */
  fastify.put<{
    Params: { seriesId: string };
    Body: {
      presetName?: MoireSuppressorPresetName;
      suppressionStrength?: number;
      deltaClamp?: number;
      edgeThreshold?: number;
      filterRadius?: number;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/moire-suppressor/profile/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;

    if (!seriesId || seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid or missing seriesId parameter',
      });
    }

    const body = request.body || {};

    if (body.presetName && !MOIRE_SUPPRESSOR_PRESETS[body.presetName]) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: `Invalid presetName: ${body.presetName}`,
      });
    }

    if (body.suppressionStrength !== undefined && (body.suppressionStrength < 0.0 || body.suppressionStrength > 1.0)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'suppressionStrength must be between 0.0 and 1.0',
      });
    }

    if (body.deltaClamp !== undefined && (body.deltaClamp < 0.0 || body.deltaClamp > 64.0)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'deltaClamp must be between 0.0 and 64.0',
      });
    }

    if (body.edgeThreshold !== undefined && (body.edgeThreshold < 5.0 || body.edgeThreshold > 100.0)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'edgeThreshold must be between 5.0 and 100.0',
      });
    }

    if (body.filterRadius !== undefined && (body.filterRadius < 1 || body.filterRadius > 5)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'filterRadius must be an integer between 1 and 5',
      });
    }

    const updated = service.saveProfile(seriesId, body);
    const etag = computeMoireSuppressorEtag(
      updated.seriesId,
      updated.presetName,
      updated.suppressionStrength,
      updated.deltaClamp,
      updated.edgeThreshold,
      updated.filterRadius,
      updated.isEnabled,
      updated.updatedAt
    );

    reply.header('ETag', etag);
    return reply.status(200).send({
      success: true,
      profile: updated,
    });
  });

  /**
   * POST /api/v1/reader/moire-suppressor/evaluate
   */
  fastify.post<{
    Body: {
      centerLum?: number;
      localAvgLum?: number;
      dLdx?: number;
      dLdy?: number;
      autocorrPeak?: number;
      suppressionStrength?: number;
      deltaClamp?: number;
      edgeThreshold?: number;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/moire-suppressor/evaluate', async (request, reply) => {
    const {
      centerLum = 128,
      localAvgLum = 140,
      dLdx = 0,
      dLdy = 0,
      autocorrPeak = 0.5,
      suppressionStrength = 0.45,
      deltaClamp = 16.0,
      edgeThreshold = 32.0,
      isEnabled = true,
    } = request.body || {};

    const result = calculateMoireSuppression(
      centerLum,
      localAvgLum,
      dLdx,
      dLdy,
      autocorrPeak,
      suppressionStrength,
      deltaClamp,
      edgeThreshold,
      isEnabled
    );

    return reply.status(200).send({
      success: true,
      result,
    });
  });
};
