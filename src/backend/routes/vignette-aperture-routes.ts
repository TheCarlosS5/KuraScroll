/**
 * KuraScroll - Sprint 121: Dynamic Atmospheric Vignette Shader & Depth-of-Field Aperture Simulator Routes
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  VignetteApertureService,
  VignettePresetName,
  calculateVignetteAperture,
  VIGNETTE_APERTURE_PRESETS,
} from '../services/vignette-aperture-service.js';

export interface VignetteApertureRoutesOptions {
  db: DatabaseInstance;
  vignetteApertureService?: VignetteApertureService;
}

export function computeVignetteApertureEtag(
  seriesId: string,
  presetName: string,
  innerRadius: number,
  outerRadius: number,
  vignetteStrength: number,
  dofBlurFactor: number,
  focusXPct: number,
  focusYPct: number,
  aspectRatio: number,
  isEnabled: boolean,
  updatedAt: number
): string {
  return `"va-${seriesId}-${presetName}-${innerRadius}-${outerRadius}-${vignetteStrength}-${dofBlurFactor}-${focusXPct}-${focusYPct}-${aspectRatio}-${isEnabled ? 1 : 0}-${updatedAt}"`;
}

export const vignetteApertureRoutes: FastifyPluginAsync<VignetteApertureRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: VignetteApertureRoutesOptions
) => {
  const service = opts.vignetteApertureService ?? new VignetteApertureService(opts.db);

  /**
   * GET /api/v1/reader/vignette-aperture/presets
   * Retrieves all available vignette and aperture presets
   */
  fastify.get('/api/v1/reader/vignette-aperture/presets', async (_request, reply) => {
    return reply.status(200).send({
      success: true,
      presets: VIGNETTE_APERTURE_PRESETS,
    });
  });

  /**
   * GET /api/v1/reader/vignette-aperture/profile/:seriesId
   * Retrieves active profile with ETag caching
   */
  fastify.get<{
    Params: { seriesId: string };
  }>('/api/v1/reader/vignette-aperture/profile/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;

    if (!seriesId || seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid or missing seriesId parameter',
      });
    }

    const profile = service.getProfile(seriesId);
    const etag = computeVignetteApertureEtag(
      profile.seriesId,
      profile.presetName,
      profile.innerRadius,
      profile.outerRadius,
      profile.vignetteStrength,
      profile.dofBlurFactor,
      profile.focusXPct,
      profile.focusYPct,
      profile.aspectRatio,
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
   * POST /api/v1/reader/vignette-aperture/profile
   * Saves or updates vignette aperture profile
   */
  fastify.post<{
    Body: {
      seriesId: string;
      presetName?: VignettePresetName;
      innerRadius?: number;
      outerRadius?: number;
      vignetteStrength?: number;
      dofBlurFactor?: number;
      focusXPct?: number;
      focusYPct?: number;
      aspectRatio?: number;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/vignette-aperture/profile', async (request, reply) => {
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
      innerRadius: body.innerRadius,
      outerRadius: body.outerRadius,
      vignetteStrength: body.vignetteStrength,
      dofBlurFactor: body.dofBlurFactor,
      focusXPct: body.focusXPct,
      focusYPct: body.focusYPct,
      aspectRatio: body.aspectRatio,
      isEnabled: body.isEnabled,
    });

    return reply.status(200).send({ success: true, profile: updated });
  });

  /**
   * POST /api/v1/reader/vignette-aperture/calculate
   * Real-time zero-allocation vignette and DoF falloff calculation
   */
  fastify.post<{
    Body: {
      pixelX: number;
      pixelY: number;
      viewportWidth: number;
      viewportHeight: number;
      focusXPct?: number;
      focusYPct?: number;
      innerRadius?: number;
      outerRadius?: number;
      vignetteStrength?: number;
      dofBlurFactor?: number;
      aspectRatio?: number;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/vignette-aperture/calculate', async (request, reply) => {
    const {
      pixelX,
      pixelY,
      viewportWidth,
      viewportHeight,
      focusXPct,
      focusYPct,
      innerRadius,
      outerRadius,
      vignetteStrength,
      dofBlurFactor,
      aspectRatio,
      isEnabled,
    } = request.body ?? {};

    if (
      pixelX === undefined ||
      pixelY === undefined ||
      viewportWidth === undefined ||
      viewportHeight === undefined
    ) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Missing required coordinates or dimensions (pixelX, pixelY, viewportWidth, viewportHeight)',
      });
    }

    const result = calculateVignetteAperture(
      pixelX,
      pixelY,
      viewportWidth,
      viewportHeight,
      focusXPct,
      focusYPct,
      innerRadius,
      outerRadius,
      vignetteStrength,
      dofBlurFactor,
      aspectRatio,
      isEnabled
    );

    return reply.status(200).send({
      success: true,
      result,
    });
  });
};
