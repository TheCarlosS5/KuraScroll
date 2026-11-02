/**
 * KuraScroll - Sprint 115: Perceptual Micro-Stippling Halftone Grain Synthesizer & Retro Print Simulator Routes
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  HalftoneGrainService,
  GrainMode,
  BlendMode,
  calculateHalftoneGrain,
  HALFTONE_GRAIN_PRESETS,
} from '../services/halftone-grain-service.js';

export interface HalftoneGrainRoutesOptions {
  db: DatabaseInstance;
  halftoneGrainService?: HalftoneGrainService;
}

export function computeHalftoneGrainEtag(
  seriesId: string,
  grainMode: string,
  stippleDensity: number,
  grainOpacity: number,
  particleRadiusPx: number,
  lcgSeed: number,
  paperTintHex: string,
  blendMode: string,
  isEnabled: boolean,
  updatedAt: number
): string {
  return `"hg-${seriesId}-${grainMode}-${stippleDensity}-${grainOpacity}-${particleRadiusPx}-${lcgSeed}-${paperTintHex}-${blendMode}-${isEnabled ? 1 : 0}-${updatedAt}"`;
}

export const halftoneGrainRoutes: FastifyPluginAsync<HalftoneGrainRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: HalftoneGrainRoutesOptions
) => {
  const service = opts.halftoneGrainService ?? new HalftoneGrainService(opts.db);

  /**
   * GET /api/v1/reader/halftone-grain/presets
   * Retrieves all available halftone grain presets
   */
  fastify.get('/api/v1/reader/halftone-grain/presets', async (_request, reply) => {
    return reply.status(200).send({
      success: true,
      presets: HALFTONE_GRAIN_PRESETS,
    });
  });

  /**
   * GET /api/v1/reader/halftone-grain/profile/:seriesId
   * Retrieves active profile with ETag caching
   */
  fastify.get<{
    Params: { seriesId: string };
  }>('/api/v1/reader/halftone-grain/profile/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;

    if (!seriesId || seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid or missing seriesId parameter',
      });
    }

    const profile = service.getProfile(seriesId);
    const etag = computeHalftoneGrainEtag(
      profile.seriesId,
      profile.grainMode,
      profile.stippleDensity,
      profile.grainOpacity,
      profile.particleRadiusPx,
      profile.lcgSeed,
      profile.paperTintHex,
      profile.blendMode,
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
   * POST /api/v1/reader/halftone-grain/profile
   * Saves or updates halftone grain profile
   */
  fastify.post<{
    Body: {
      seriesId: string;
      grainMode?: GrainMode;
      stippleDensity?: number;
      grainOpacity?: number;
      particleRadiusPx?: number;
      lcgSeed?: number;
      paperTintHex?: string;
      blendMode?: BlendMode;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/halftone-grain/profile', async (request, reply) => {
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
      grainMode: body.grainMode,
      stippleDensity: body.stippleDensity,
      grainOpacity: body.grainOpacity,
      particleRadiusPx: body.particleRadiusPx,
      lcgSeed: body.lcgSeed,
      paperTintHex: body.paperTintHex,
      blendMode: body.blendMode,
      isEnabled: body.isEnabled,
    });

    return reply.status(200).send({ success: true, profile: updated });
  });

  /**
   * POST /api/v1/reader/halftone-grain/calculate
   * Real-time zero-allocation halftone grain calculation
   */
  fastify.post<{
    Body: {
      density?: number;
      opacity?: number;
      radiusPx?: number;
      seed?: number;
      grainMode?: GrainMode;
      paperTintHex?: string;
      blendMode?: BlendMode;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/halftone-grain/calculate', async (request, reply) => {
    const {
      density,
      opacity,
      radiusPx,
      seed,
      grainMode,
      paperTintHex,
      blendMode,
      isEnabled,
    } = request.body ?? {};

    const result = calculateHalftoneGrain(
      density,
      opacity,
      radiusPx,
      seed,
      grainMode,
      paperTintHex,
      blendMode,
      isEnabled
    );

    return reply.status(200).send({
      success: true,
      result,
    });
  });
};
