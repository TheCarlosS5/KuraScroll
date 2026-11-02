/**
 * KuraScroll - Sprint 91: Adaptive Sub-Pixel Color Fringe Neutralizer & In-Viewport Text Sharpening Fastify Routes
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  ChromaticFringeService,
  ChromaticFringeProfile,
  NeutralizerMode,
  CHROMATIC_FRINGE_CONFIGS,
} from '../services/chromatic-fringe-service.js';

export interface ChromaticFringeRoutesOptions {
  db: DatabaseInstance;
  chromaticFringeService?: ChromaticFringeService;
}

export function computeChromaticFringeEtag(
  seriesId: string,
  neutralizerMode: string,
  fringeRadiusPx: number,
  desaturationStrength: number,
  sharpeningAmount: number,
  isEnabled: boolean,
  updatedAt: number
): string {
  return `"cf-${seriesId}-${neutralizerMode}-${fringeRadiusPx}-${desaturationStrength}-${sharpeningAmount}-${isEnabled ? 1 : 0}-${updatedAt}"`;
}

export const chromaticFringeRoutes: FastifyPluginAsync<ChromaticFringeRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: ChromaticFringeRoutesOptions
) => {
  const service = opts.chromaticFringeService ?? new ChromaticFringeService(opts.db);

  /**
   * GET /api/v1/reader/chromatic-fringe/profile/:seriesId
   * Retrieves active profile with ETag caching
   */
  fastify.get<{
    Params: { seriesId: string };
  }>('/api/v1/reader/chromatic-fringe/profile/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;

    if (!seriesId || seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid seriesId parameter',
      });
    }

    const profile = service.getProfile(seriesId);
    const etag = computeChromaticFringeEtag(
      profile.seriesId,
      profile.neutralizerMode,
      profile.fringeRadiusPx,
      profile.desaturationStrength,
      profile.sharpeningAmount,
      profile.isEnabled,
      profile.updatedAt
    );

    if (request.headers['if-none-match'] === etag) {
      return reply.status(304).send();
    }

    reply.header('Cache-Control', 'private, max-age=60, must-revalidate');
    reply.header('ETag', etag);
    return reply.status(200).send({ success: true, profile });
  });

  /**
   * POST /api/v1/reader/chromatic-fringe/profile
   * Saves or updates a chromatic fringe profile
   */
  fastify.post<{
    Body: {
      seriesId: string;
      neutralizerMode?: NeutralizerMode;
      fringeRadiusPx?: number;
      desaturationStrength?: number;
      sharpeningAmount?: number;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/chromatic-fringe/profile', async (request, reply) => {
    const body = request.body;
    if (!body || !body.seriesId || body.seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Missing or empty seriesId',
      });
    }

    const current = service.getProfile(body.seriesId);
    const updated = service.setProfile({
      seriesId: body.seriesId,
      neutralizerMode: body.neutralizerMode ?? current.neutralizerMode,
      fringeRadiusPx: body.fringeRadiusPx ?? current.fringeRadiusPx,
      desaturationStrength: body.desaturationStrength ?? current.desaturationStrength,
      sharpeningAmount: body.sharpeningAmount ?? current.sharpeningAmount,
      isEnabled: body.isEnabled !== undefined ? body.isEnabled : current.isEnabled,
      updatedAt: Date.now(),
    });

    return reply.status(200).send({ success: true, profile: updated });
  });

  /**
   * POST /api/v1/reader/chromatic-fringe/calculate-matrix
   * Calculates subpixel fringe neutralization matrix in sub-20 microseconds
   */
  fastify.post<{
    Body: {
      mode?: NeutralizerMode;
      fringeRadius?: number;
      desaturation?: number;
      sharpening?: number;
    };
  }>('/api/v1/reader/chromatic-fringe/calculate-matrix', async (request, reply) => {
    const { mode, fringeRadius, desaturation, sharpening } = request.body || {};

    const result = service.calculateFringeNeutralizerMatrix(
      mode ?? 'subpixel_rgb',
      fringeRadius ?? 0.75,
      desaturation ?? 0.60,
      sharpening ?? 1.25
    );

    return reply.status(200).send({ success: true, result });
  });

  /**
   * GET /api/v1/reader/chromatic-fringe/presets
   * Lists predefined neutralizer modes
   */
  fastify.get('/api/v1/reader/chromatic-fringe/presets', async (_request, reply) => {
    return reply.status(200).send({
      success: true,
      presets: CHROMATIC_FRINGE_CONFIGS,
    });
  });
};
