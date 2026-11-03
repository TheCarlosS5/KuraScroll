/**
 * KuraScroll - Sprint 122: Contrast-Adaptive Subpixel Unsharp Mask & Micro-Sharpening Synthesizer Routes
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  UnsharpMaskService,
  UnsharpMaskPresetName,
  calculateUnsharpMask,
  UNSHARP_MASK_PRESETS,
} from '../services/unsharp-mask-service.js';

export interface UnsharpMaskRoutesOptions {
  db: DatabaseInstance;
  unsharpMaskService?: UnsharpMaskService;
}

export function computeUnsharpMaskEtag(
  seriesId: string,
  presetName: string,
  sharpness: number,
  edgeThreshold: number,
  haloClamp: number,
  maxWeight: number,
  isEnabled: boolean,
  updatedAt: number
): string {
  return `"um-${seriesId}-${presetName}-${sharpness}-${edgeThreshold}-${haloClamp}-${maxWeight}-${isEnabled ? 1 : 0}-${updatedAt}"`;
}

export const unsharpMaskRoutes: FastifyPluginAsync<UnsharpMaskRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: UnsharpMaskRoutesOptions
) => {
  const service = opts.unsharpMaskService ?? new UnsharpMaskService(opts.db);

  /**
   * GET /api/v1/reader/unsharp-mask/presets
   * Retrieves all available unsharp mask sharpening presets
   */
  fastify.get('/api/v1/reader/unsharp-mask/presets', async (_request, reply) => {
    return reply.status(200).send({
      success: true,
      presets: UNSHARP_MASK_PRESETS,
    });
  });

  /**
   * GET /api/v1/reader/unsharp-mask/profile/:seriesId
   * Retrieves active profile with ETag caching
   */
  fastify.get<{
    Params: { seriesId: string };
  }>('/api/v1/reader/unsharp-mask/profile/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;

    if (!seriesId || seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid or missing seriesId parameter',
      });
    }

    const profile = service.getProfile(seriesId);
    const etag = computeUnsharpMaskEtag(
      profile.seriesId,
      profile.presetName,
      profile.sharpness,
      profile.edgeThreshold,
      profile.haloClamp,
      profile.maxWeight,
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
   * POST /api/v1/reader/unsharp-mask/profile
   * Saves or updates unsharp mask profile
   */
  fastify.post<{
    Body: {
      seriesId: string;
      presetName?: UnsharpMaskPresetName;
      sharpness?: number;
      edgeThreshold?: number;
      haloClamp?: number;
      maxWeight?: number;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/unsharp-mask/profile', async (request, reply) => {
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
      sharpness: body.sharpness,
      edgeThreshold: body.edgeThreshold,
      haloClamp: body.haloClamp,
      maxWeight: body.maxWeight,
      isEnabled: body.isEnabled,
    });

    return reply.status(200).send({ success: true, profile: updated });
  });

  /**
   * POST /api/v1/reader/unsharp-mask/calculate
   * Real-time zero-allocation 5-point cross stencil sharpening calculation
   */
  fastify.post<{
    Body: {
      center: number;
      north: number;
      south: number;
      east: number;
      west: number;
      sharpness?: number;
      edgeThreshold?: number;
      haloClamp?: number;
      maxWeight?: number;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/unsharp-mask/calculate', async (request, reply) => {
    const {
      center,
      north,
      south,
      east,
      west,
      sharpness,
      edgeThreshold,
      haloClamp,
      maxWeight,
      isEnabled,
    } = request.body ?? {};

    if (
      center === undefined ||
      north === undefined ||
      south === undefined ||
      east === undefined ||
      west === undefined
    ) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Missing required 5-point stencil coordinates (center, north, south, east, west)',
      });
    }

    const result = calculateUnsharpMask(
      center,
      north,
      south,
      east,
      west,
      sharpness,
      edgeThreshold,
      haloClamp,
      maxWeight,
      isEnabled
    );

    return reply.status(200).send({
      success: true,
      result,
    });
  });
};
