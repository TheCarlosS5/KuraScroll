/**
 * KuraScroll - Sprint 119: Adaptive Subpixel Color De-Banding & Ordered Bayer Dither Matrix Synthesizer Routes
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  BayerDitherService,
  BayerPresetName,
  BayerMatrixSize,
  BayerChannelMode,
  calculateBayerDither,
  BAYER_DITHER_PRESETS,
} from '../services/bayer-dither-service.js';

export interface BayerDitherRoutesOptions {
  db: DatabaseInstance;
  bayerDitherService?: BayerDitherService;
}

export function computeBayerDitherEtag(
  seriesId: string,
  presetName: string,
  matrixSize: number,
  targetBits: number,
  ditherStrength: number,
  edgeProtection: number,
  channelMode: string,
  isEnabled: boolean,
  updatedAt: number
): string {
  return `"bd-${seriesId}-${presetName}-${matrixSize}-${targetBits}-${ditherStrength}-${edgeProtection}-${channelMode}-${isEnabled ? 1 : 0}-${updatedAt}"`;
}

export const bayerDitherRoutes: FastifyPluginAsync<BayerDitherRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: BayerDitherRoutesOptions
) => {
  const service = opts.bayerDitherService ?? new BayerDitherService(opts.db);

  /**
   * GET /api/v1/reader/bayer-dither/presets
   * Retrieves all available Bayer dither presets
   */
  fastify.get('/api/v1/reader/bayer-dither/presets', async (_request, reply) => {
    return reply.status(200).send({
      success: true,
      presets: BAYER_DITHER_PRESETS,
    });
  });

  /**
   * GET /api/v1/reader/bayer-dither/profile/:seriesId
   * Retrieves active profile with ETag caching
   */
  fastify.get<{
    Params: { seriesId: string };
  }>('/api/v1/reader/bayer-dither/profile/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;

    if (!seriesId || seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid or missing seriesId parameter',
      });
    }

    const profile = service.getProfile(seriesId);
    const etag = computeBayerDitherEtag(
      profile.seriesId,
      profile.presetName,
      profile.matrixSize,
      profile.targetBits,
      profile.ditherStrength,
      profile.edgeProtection,
      profile.channelMode,
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
   * POST /api/v1/reader/bayer-dither/profile
   * Saves or updates Bayer dither profile
   */
  fastify.post<{
    Body: {
      seriesId: string;
      presetName?: BayerPresetName;
      matrixSize?: BayerMatrixSize;
      targetBits?: number;
      ditherStrength?: number;
      edgeProtection?: number;
      channelMode?: BayerChannelMode;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/bayer-dither/profile', async (request, reply) => {
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
      matrixSize: body.matrixSize,
      targetBits: body.targetBits,
      ditherStrength: body.ditherStrength,
      edgeProtection: body.edgeProtection,
      channelMode: body.channelMode,
      isEnabled: body.isEnabled,
    });

    return reply.status(200).send({ success: true, profile: updated });
  });

  /**
   * POST /api/v1/reader/bayer-dither/calculate
   * Real-time zero-allocation ordered Bayer dither pixel calculation
   */
  fastify.post<{
    Body: {
      x: number;
      y: number;
      r: number;
      g: number;
      b: number;
      matrixSize?: BayerMatrixSize;
      targetBits?: number;
      ditherStrength?: number;
      edgeProtection?: number;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/bayer-dither/calculate', async (request, reply) => {
    const {
      x,
      y,
      r,
      g,
      b,
      matrixSize,
      targetBits,
      ditherStrength,
      edgeProtection,
      isEnabled,
    } = request.body ?? {};

    if (x === undefined || y === undefined || r === undefined || g === undefined || b === undefined) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Missing required pixel coordinates or RGB channels',
      });
    }

    const result = calculateBayerDither(
      x,
      y,
      r,
      g,
      b,
      matrixSize,
      targetBits,
      ditherStrength,
      edgeProtection,
      isEnabled
    );

    return reply.status(200).send({
      success: true,
      result,
    });
  });
};
