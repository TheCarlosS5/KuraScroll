/**
 * KuraScroll - Sprint 113: Subpixel Micro-Vector Glyph Sharpener & Anti-Aliasing Edge Contrast Enhancer Routes
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  GlyphSharpenerService,
  SharpenerMode,
  StrokeDensityTier,
  calculateGlyphSharpener,
  GLYPH_SHARPENER_PRESETS,
} from '../services/glyph-sharpener-service.js';

export interface GlyphSharpenerRoutesOptions {
  db: DatabaseInstance;
  glyphSharpenerService?: GlyphSharpenerService;
}

export function computeGlyphSharpenerEtag(
  seriesId: string,
  sharpenerMode: string,
  strokeDensityTier: string,
  contrastMultiplier: number,
  luminanceGamma: number,
  strokeProtectionPct: number,
  isEnabled: boolean,
  updatedAt: number
): string {
  return `"gs-${seriesId}-${sharpenerMode}-${strokeDensityTier}-${contrastMultiplier}-${luminanceGamma}-${strokeProtectionPct}-${isEnabled ? 1 : 0}-${updatedAt}"`;
}

export const glyphSharpenerRoutes: FastifyPluginAsync<GlyphSharpenerRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: GlyphSharpenerRoutesOptions
) => {
  const service = opts.glyphSharpenerService ?? new GlyphSharpenerService(opts.db);

  /**
   * GET /api/v1/reader/glyph-sharpener/profile/:seriesId
   * Retrieves active profile with ETag caching
   */
  fastify.get<{
    Params: { seriesId: string };
  }>('/api/v1/reader/glyph-sharpener/profile/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;

    if (!seriesId || seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid or missing seriesId parameter',
      });
    }

    const profile = service.getProfile(seriesId);
    const etag = computeGlyphSharpenerEtag(
      profile.seriesId,
      profile.sharpenerMode,
      profile.strokeDensityTier,
      profile.contrastMultiplier,
      profile.luminanceGamma,
      profile.strokeProtectionPct,
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
   * POST /api/v1/reader/glyph-sharpener/profile
   * Saves or updates glyph sharpener profile
   */
  fastify.post<{
    Body: {
      seriesId: string;
      sharpenerMode?: SharpenerMode;
      strokeDensityTier?: StrokeDensityTier;
      contrastMultiplier?: number;
      luminanceGamma?: number;
      strokeProtectionPct?: number;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/glyph-sharpener/profile', async (request, reply) => {
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
      sharpenerMode: body.sharpenerMode,
      strokeDensityTier: body.strokeDensityTier,
      contrastMultiplier: body.contrastMultiplier,
      luminanceGamma: body.luminanceGamma,
      strokeProtectionPct: body.strokeProtectionPct,
      isEnabled: body.isEnabled,
    });

    return reply.status(200).send({ success: true, profile: updated });
  });

  /**
   * POST /api/v1/reader/glyph-sharpener/calculate
   * Real-time zero-allocation edge contrast & anti-aliasing calculation
   */
  fastify.post<{
    Body: {
      strokeCount?: number;
      devicePixelRatio?: number;
      contrastMultiplier?: number;
      luminanceGamma?: number;
      strokeProtectionPct?: number;
      mode?: SharpenerMode;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/glyph-sharpener/calculate', async (request, reply) => {
    const body = request.body ?? {};

    const result = calculateGlyphSharpener(
      body.strokeCount ?? 8,
      body.devicePixelRatio ?? 1.0,
      body.contrastMultiplier ?? 1.15,
      body.luminanceGamma ?? 1.05,
      body.strokeProtectionPct ?? 65,
      body.mode ?? 'adaptive_kanji',
      body.isEnabled ?? true
    );

    return reply.status(200).send({
      success: true,
      result,
    });
  });

  /**
   * GET /api/v1/reader/glyph-sharpener/presets
   * Retrieves predefined typographic edge presets
   */
  fastify.get('/api/v1/reader/glyph-sharpener/presets', async (_request, reply) => {
    return reply.status(200).send({
      success: true,
      presets: service.getPresets(),
    });
  });
};
