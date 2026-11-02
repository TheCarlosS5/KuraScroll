/**
 * KuraScroll - Sprint 110: Perceptual Ambient Chroma Bleed & Color-Temperature Adaptive Edge Backlight Routes
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  ChromaBleedService,
  ColorMode,
  calculateChromaBleed,
  CHROMA_BLEED_PRESETS,
} from '../services/chroma-bleed-service.js';

export interface ChromaBleedRoutesOptions {
  db: DatabaseInstance;
  chromaBleedService?: ChromaBleedService;
}

export function computeChromaBleedEtag(
  seriesId: string,
  colorMode: string,
  colorTemperatureK: number,
  bleedSpreadPx: number,
  ambientIntensityPct: number,
  edgeFalloffExponent: number,
  isEnabled: boolean,
  updatedAt: number
): string {
  return `"cb-${seriesId}-${colorMode}-${colorTemperatureK}-${bleedSpreadPx}-${ambientIntensityPct}-${edgeFalloffExponent}-${isEnabled ? 1 : 0}-${updatedAt}"`;
}

export const chromaBleedRoutes: FastifyPluginAsync<ChromaBleedRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: ChromaBleedRoutesOptions
) => {
  const service = opts.chromaBleedService ?? new ChromaBleedService(opts.db);

  /**
   * GET /api/v1/reader/chroma-bleed/profile/:seriesId
   * Retrieves active profile with ETag caching
   */
  fastify.get<{
    Params: { seriesId: string };
  }>('/api/v1/reader/chroma-bleed/profile/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;

    if (!seriesId || seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid or missing seriesId parameter',
      });
    }

    const profile = service.getProfile(seriesId);
    const etag = computeChromaBleedEtag(
      profile.seriesId,
      profile.colorMode,
      profile.colorTemperatureK,
      profile.bleedSpreadPx,
      profile.ambientIntensityPct,
      profile.edgeFalloffExponent,
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
   * POST /api/v1/reader/chroma-bleed/profile
   * Saves or updates chroma bleed profile
   */
  fastify.post<{
    Body: {
      seriesId: string;
      colorMode?: ColorMode;
      colorTemperatureK?: number;
      bleedSpreadPx?: number;
      ambientIntensityPct?: number;
      edgeFalloffExponent?: number;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/chroma-bleed/profile', async (request, reply) => {
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
      colorMode: body.colorMode,
      colorTemperatureK: body.colorTemperatureK,
      bleedSpreadPx: body.bleedSpreadPx,
      ambientIntensityPct: body.ambientIntensityPct,
      edgeFalloffExponent: body.edgeFalloffExponent,
      isEnabled: body.isEnabled,
    });

    return reply.status(200).send({ success: true, profile: updated });
  });

  /**
   * POST /api/v1/reader/chroma-bleed/calculate
   * Real-time zero-allocation chroma bleed calculation
   */
  fastify.post<{
    Body: {
      colorTemperatureK?: number;
      bleedSpreadPx?: number;
      ambientIntensityPct?: number;
      edgeFalloffExponent?: number;
      colorMode?: ColorMode;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/chroma-bleed/calculate', async (request, reply) => {
    const body = request.body ?? {};

    const result = calculateChromaBleed(
      body.colorTemperatureK ?? 6500,
      body.bleedSpreadPx ?? 24,
      body.ambientIntensityPct ?? 35,
      body.edgeFalloffExponent ?? 2.2,
      body.colorMode ?? 'monochrome_bw',
      body.isEnabled ?? true
    );

    return reply.status(200).send({
      success: true,
      result,
    });
  });

  /**
   * GET /api/v1/reader/chroma-bleed/presets
   * Retrieves predefined ambient chroma presets
   */
  fastify.get('/api/v1/reader/chroma-bleed/presets', async (_request, reply) => {
    return reply.status(200).send({
      success: true,
      presets: service.getPresets(),
    });
  });
};
