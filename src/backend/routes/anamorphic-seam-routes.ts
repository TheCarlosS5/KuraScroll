/**
 * KuraScroll - Sprint 111: Adaptive Panel Aspect-Ratio Anamorphic Un-Squeeze & Webtoon Seam Stitcher Routes
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  AnamorphicSeamService,
  AspectRatioMode,
  SubpixelSnappingMode,
  calculateAnamorphicSeam,
  ANAMORPHIC_SEAM_PRESETS,
} from '../services/anamorphic-seam-service.js';

export interface AnamorphicSeamRoutesOptions {
  db: DatabaseInstance;
  anamorphicSeamService?: AnamorphicSeamService;
}

export function computeAnamorphicSeamEtag(
  seriesId: string,
  aspectRatioMode: string,
  unsqueezeFactor: number,
  seamOverlapPx: number,
  subpixelSnappingMode: string,
  isEnabled: boolean,
  updatedAt: number
): string {
  return `"as-${seriesId}-${aspectRatioMode}-${unsqueezeFactor}-${seamOverlapPx}-${subpixelSnappingMode}-${isEnabled ? 1 : 0}-${updatedAt}"`;
}

export const anamorphicSeamRoutes: FastifyPluginAsync<AnamorphicSeamRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: AnamorphicSeamRoutesOptions
) => {
  const service = opts.anamorphicSeamService ?? new AnamorphicSeamService(opts.db);

  /**
   * GET /api/v1/reader/anamorphic-seam/profile/:seriesId
   * Retrieves active profile with ETag caching
   */
  fastify.get<{
    Params: { seriesId: string };
  }>('/api/v1/reader/anamorphic-seam/profile/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;

    if (!seriesId || seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid or missing seriesId parameter',
      });
    }

    const profile = service.getProfile(seriesId);
    const etag = computeAnamorphicSeamEtag(
      profile.seriesId,
      profile.aspectRatioMode,
      profile.unsqueezeFactor,
      profile.seamOverlapPx,
      profile.subpixelSnappingMode,
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
   * POST /api/v1/reader/anamorphic-seam/profile
   * Saves or updates anamorphic seam profile
   */
  fastify.post<{
    Body: {
      seriesId: string;
      aspectRatioMode?: AspectRatioMode;
      unsqueezeFactor?: number;
      seamOverlapPx?: number;
      subpixelSnappingMode?: SubpixelSnappingMode;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/anamorphic-seam/profile', async (request, reply) => {
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
      aspectRatioMode: body.aspectRatioMode,
      unsqueezeFactor: body.unsqueezeFactor,
      seamOverlapPx: body.seamOverlapPx,
      subpixelSnappingMode: body.subpixelSnappingMode,
      isEnabled: body.isEnabled,
    });

    return reply.status(200).send({ success: true, profile: updated });
  });

  /**
   * POST /api/v1/reader/anamorphic-seam/calculate
   * Real-time zero-allocation seam coordinates & un-squeeze transformation calculation
   */
  fastify.post<{
    Body: {
      sliceIndex?: number;
      rawStartY?: number;
      rawHeight?: number;
      aspectRatioMode?: AspectRatioMode;
      unsqueezeFactor?: number;
      seamOverlapPx?: number;
      subpixelSnappingMode?: SubpixelSnappingMode;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/anamorphic-seam/calculate', async (request, reply) => {
    const body = request.body ?? {};

    const result = calculateAnamorphicSeam(
      body.sliceIndex ?? 0,
      body.rawStartY ?? 0,
      body.rawHeight ?? 1000,
      body.aspectRatioMode ?? 'native',
      body.unsqueezeFactor ?? 1.0,
      body.seamOverlapPx ?? 0.75,
      body.subpixelSnappingMode ?? 'cumulative_origin',
      body.isEnabled ?? true
    );

    return reply.status(200).send({
      success: true,
      result,
    });
  });

  /**
   * GET /api/v1/reader/anamorphic-seam/presets
   * Retrieves predefined aspect ratio & seam presets
   */
  fastify.get('/api/v1/reader/anamorphic-seam/presets', async (_request, reply) => {
    return reply.status(200).send({
      success: true,
      presets: service.getPresets(),
    });
  });
};
