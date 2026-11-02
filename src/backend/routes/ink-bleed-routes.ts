/**
 * KuraScroll - Sprint 103: Ink Bleed Fastify Routes
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  InkBleedService,
  InkBleedProfile,
  CompensationMode,
  calculateInkBleedCompensation,
  INK_BLEED_PRESETS,
} from '../services/ink-bleed-service.js';

export interface InkBleedRoutesOptions {
  db: DatabaseInstance;
  inkBleedService?: InkBleedService;
}

export function computeInkBleedEtag(
  seriesId: string,
  compensationMode: string,
  blackPointLift: number,
  whitePointCompression: number,
  gammaExponent: number,
  inkBleedThreshold: number,
  isEnabled: boolean,
  updatedAt: number
): string {
  return `"ib-${seriesId}-${compensationMode}-${blackPointLift}-${whitePointCompression}-${gammaExponent}-${inkBleedThreshold}-${isEnabled ? 1 : 0}-${updatedAt}"`;
}

export const inkBleedRoutes: FastifyPluginAsync<InkBleedRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: InkBleedRoutesOptions
) => {
  const service = opts.inkBleedService ?? new InkBleedService(opts.db);

  /**
   * GET /api/v1/reader/ink-bleed/profile/:seriesId
   * Retrieves active profile with ETag caching
   */
  fastify.get<{
    Params: { seriesId: string };
  }>('/api/v1/reader/ink-bleed/profile/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;

    if (!seriesId || seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid or missing seriesId parameter',
      });
    }

    const profile = service.getProfile(seriesId);
    const etag = computeInkBleedEtag(
      profile.seriesId,
      profile.compensationMode,
      profile.blackPointLift,
      profile.whitePointCompression,
      profile.gammaExponent,
      profile.inkBleedThreshold,
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
   * POST /api/v1/reader/ink-bleed/profile
   * Saves or updates ink bleed compensation profile
   */
  fastify.post<{
    Body: {
      seriesId: string;
      compensationMode?: CompensationMode;
      blackPointLift?: number;
      whitePointCompression?: number;
      gammaExponent?: number;
      inkBleedThreshold?: number;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/ink-bleed/profile', async (request, reply) => {
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
      compensationMode: body.compensationMode,
      blackPointLift: body.blackPointLift,
      whitePointCompression: body.whitePointCompression,
      gammaExponent: body.gammaExponent,
      inkBleedThreshold: body.inkBleedThreshold,
      isEnabled: body.isEnabled,
    });

    return reply.status(200).send({ success: true, profile: updated });
  });

  /**
   * POST /api/v1/reader/ink-bleed/calculate-compensation
   * Real-time zero-allocation transfer function & CSS filter calculation
   */
  fastify.post<{
    Body: {
      blackPointLift?: number;
      whitePointCompression?: number;
      gammaExponent?: number;
      inkBleedThreshold?: number;
      ambientLux?: number;
      mode?: CompensationMode;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/ink-bleed/calculate-compensation', async (request, reply) => {
    const body = request.body ?? {};

    const result = calculateInkBleedCompensation(
      body.blackPointLift ?? 0.08,
      body.whitePointCompression ?? 0.95,
      body.gammaExponent ?? 1.15,
      body.inkBleedThreshold ?? 0.18,
      body.ambientLux ?? 120,
      body.mode ?? 'vintage_newsprint',
      body.isEnabled ?? true
    );

    return reply.status(200).send({
      success: true,
      result,
    });
  });

  /**
   * GET /api/v1/reader/ink-bleed/presets
   * Retrieves predefined tone-mapping presets
   */
  fastify.get('/api/v1/reader/ink-bleed/presets', async (_request, reply) => {
    return reply.status(200).send({
      success: true,
      presets: service.getPresets(),
    });
  });
};
