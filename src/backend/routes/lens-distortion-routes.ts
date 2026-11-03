/**
 * KuraScroll - Sprint 126: Subpixel Chromatic Aberration & Lens Distortion Compensator Routes
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  LensDistortionService,
  LensDistortionPresetName,
  LENS_DISTORTION_PRESETS,
  calculateLensDistortion,
} from '../services/lens-distortion-service.js';

export interface LensDistortionRoutesOptions {
  db: DatabaseInstance;
  lensDistortionService?: LensDistortionService;
}

export function computeLensDistortionEtag(
  seriesId: string,
  presetName: string,
  k1: number,
  k2: number,
  redShift: number,
  blueShift: number,
  scale: number,
  isEnabled: boolean,
  updatedAt: number
): string {
  return `"ld-${seriesId}-${presetName}-${k1}-${k2}-${redShift}-${blueShift}-${scale}-${isEnabled ? 1 : 0}-${updatedAt}"`;
}

export const lensDistortionRoutes: FastifyPluginAsync<LensDistortionRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: LensDistortionRoutesOptions
) => {
  const service = opts.lensDistortionService ?? new LensDistortionService(opts.db);

  /**
   * GET /api/v1/reader/lens-distortion/presets
   */
  fastify.get('/api/v1/reader/lens-distortion/presets', async (_request, reply) => {
    return reply.status(200).send({
      success: true,
      presets: LENS_DISTORTION_PRESETS,
    });
  });

  /**
   * GET /api/v1/reader/lens-distortion/profile/:seriesId
   */
  fastify.get<{
    Params: { seriesId: string };
  }>('/api/v1/reader/lens-distortion/profile/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;

    if (!seriesId || seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid or missing seriesId parameter',
      });
    }

    const profile = service.getProfile(seriesId);
    const etag = computeLensDistortionEtag(
      profile.seriesId,
      profile.presetName,
      profile.k1,
      profile.k2,
      profile.redShift,
      profile.blueShift,
      profile.scale,
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
   * PUT /api/v1/reader/lens-distortion/profile/:seriesId
   */
  fastify.put<{
    Params: { seriesId: string };
    Body: {
      presetName?: LensDistortionPresetName;
      k1?: number;
      k2?: number;
      redShift?: number;
      blueShift?: number;
      centerX?: number;
      centerY?: number;
      scale?: number;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/lens-distortion/profile/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;

    if (!seriesId || seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid or missing seriesId parameter',
      });
    }

    const body = request.body || {};

    if (body.presetName && !LENS_DISTORTION_PRESETS[body.presetName]) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: `Invalid presetName: ${body.presetName}`,
      });
    }

    if (body.k1 !== undefined && (body.k1 < -0.20 || body.k1 > 0.20)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'k1 must be between -0.20 and 0.20',
      });
    }

    if (body.k2 !== undefined && (body.k2 < -0.05 || body.k2 > 0.05)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'k2 must be between -0.05 and 0.05',
      });
    }

    if (body.redShift !== undefined && (body.redShift < -0.05 || body.redShift > 0.05)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'redShift must be between -0.05 and 0.05',
      });
    }

    if (body.blueShift !== undefined && (body.blueShift < -0.05 || body.blueShift > 0.05)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'blueShift must be between -0.05 and 0.05',
      });
    }

    if (body.scale !== undefined && (body.scale < 0.80 || body.scale > 1.20)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'scale must be between 0.80 and 1.20',
      });
    }

    const updated = service.saveProfile(seriesId, body);
    const etag = computeLensDistortionEtag(
      updated.seriesId,
      updated.presetName,
      updated.k1,
      updated.k2,
      updated.redShift,
      updated.blueShift,
      updated.scale,
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
   * POST /api/v1/reader/lens-distortion/evaluate
   */
  fastify.post<{
    Body: {
      normX?: number;
      normY?: number;
      k1?: number;
      k2?: number;
      redShift?: number;
      blueShift?: number;
      centerX?: number;
      centerY?: number;
      scale?: number;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/lens-distortion/evaluate', async (request, reply) => {
    const {
      normX = 0.50,
      normY = 0.50,
      k1 = -0.015,
      k2 = 0.002,
      redShift = 0.004,
      blueShift = -0.004,
      centerX = 0.50,
      centerY = 0.50,
      scale = 1.00,
      isEnabled = true,
    } = request.body || {};

    const result = calculateLensDistortion(
      normX,
      normY,
      k1,
      k2,
      redShift,
      blueShift,
      centerX,
      centerY,
      scale,
      isEnabled
    );

    return reply.status(200).send({
      success: true,
      result,
    });
  });
};
