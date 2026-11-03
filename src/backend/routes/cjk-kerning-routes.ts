/**
 * KuraScroll - Sprint 124: Subpixel Font Kerning & CJK Stroke Density Balancer Routes
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  CJKKerningService,
  CJKPresetName,
  calculateCJKKerning,
  CJK_KERNING_PRESETS,
} from '../services/cjk-kerning-service.js';

export interface CJKKerningRoutesOptions {
  db: DatabaseInstance;
  cjkKerningService?: CJKKerningService;
}

export function computeCJKKerningEtag(
  seriesId: string,
  presetName: string,
  baseKerningEm: number,
  trackingRatio: number,
  minKerningEm: number,
  maxKerningEm: number,
  opticalWeightRatio: number,
  isEnabled: boolean,
  updatedAt: number
): string {
  return `"ck-${seriesId}-${presetName}-${baseKerningEm}-${trackingRatio}-${minKerningEm}-${maxKerningEm}-${opticalWeightRatio}-${isEnabled ? 1 : 0}-${updatedAt}"`;
}

export const cjkKerningRoutes: FastifyPluginAsync<CJKKerningRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: CJKKerningRoutesOptions
) => {
  const service = opts.cjkKerningService ?? new CJKKerningService(opts.db);

  /**
   * GET /api/v1/reader/cjk-kerning/presets
   * Retrieves all available CJK kerning presets
   */
  fastify.get('/api/v1/reader/cjk-kerning/presets', async (_request, reply) => {
    return reply.status(200).send({
      success: true,
      presets: CJK_KERNING_PRESETS,
    });
  });

  /**
   * GET /api/v1/reader/cjk-kerning/profile/:seriesId
   * Retrieves active profile with ETag caching
   */
  fastify.get<{
    Params: { seriesId: string };
  }>('/api/v1/reader/cjk-kerning/profile/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;

    if (!seriesId || seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid or missing seriesId parameter',
      });
    }

    const profile = service.getProfile(seriesId);
    const etag = computeCJKKerningEtag(
      profile.seriesId,
      profile.presetName,
      profile.baseKerningEm,
      profile.trackingRatio,
      profile.minKerningEm,
      profile.maxKerningEm,
      profile.opticalWeightRatio,
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
   * POST /api/v1/reader/cjk-kerning/profile
   * Saves or updates CJK kerning profile
   */
  fastify.post<{
    Body: {
      seriesId: string;
      presetName?: CJKPresetName;
      baseKerningEm?: number;
      trackingRatio?: number;
      minKerningEm?: number;
      maxKerningEm?: number;
      opticalWeightRatio?: number;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/cjk-kerning/profile', async (request, reply) => {
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
      baseKerningEm: body.baseKerningEm,
      trackingRatio: body.trackingRatio,
      minKerningEm: body.minKerningEm,
      maxKerningEm: body.maxKerningEm,
      opticalWeightRatio: body.opticalWeightRatio,
      isEnabled: body.isEnabled,
    });

    return reply.status(200).send({ success: true, profile: updated });
  });

  /**
   * POST /api/v1/reader/cjk-kerning/calculate
   * Real-time zero-allocation CJK stroke complexity & kerning evaluation
   */
  fastify.post<{
    Body: {
      codepoint?: number;
      character?: string;
      baseKerningEm?: number;
      trackingRatio?: number;
      minKerningEm?: number;
      maxKerningEm?: number;
      opticalWeightRatio?: number;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/cjk-kerning/calculate', async (request, reply) => {
    let cp = request.body?.codepoint;
    if (cp === undefined && request.body?.character && request.body.character.length > 0) {
      cp = request.body.character.codePointAt(0);
    }

    if (cp === undefined) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Missing required codepoint or character parameter',
      });
    }

    const {
      baseKerningEm,
      trackingRatio,
      minKerningEm,
      maxKerningEm,
      opticalWeightRatio,
      isEnabled,
    } = request.body ?? {};

    const result = calculateCJKKerning(
      cp,
      baseKerningEm,
      trackingRatio,
      minKerningEm,
      maxKerningEm,
      opticalWeightRatio,
      isEnabled
    );

    return reply.status(200).send({
      success: true,
      result,
    });
  });
};
