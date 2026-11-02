/**
 * KuraScroll - Sprint 106: Dialogue Balloon Font Fastify Routes
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  BalloonFontService,
  BalloonFontProfile,
  FontScalingMode,
  calculateBalloonFontScale,
  BALLOON_FONT_PRESETS,
} from '../services/balloon-font-service.js';

export interface BalloonFontRoutesOptions {
  db: DatabaseInstance;
  balloonFontService?: BalloonFontService;
}

export function computeBalloonFontEtag(
  seriesId: string,
  scalingMode: string,
  minFontSizePx: number,
  maxFontSizePx: number,
  targetDensityRatio: number,
  isFuriganaPreserved: boolean,
  isEnabled: boolean,
  updatedAt: number
): string {
  return `"bf-${seriesId}-${scalingMode}-${minFontSizePx}-${maxFontSizePx}-${targetDensityRatio}-${isFuriganaPreserved ? 1 : 0}-${isEnabled ? 1 : 0}-${updatedAt}"`;
}

export const balloonFontRoutes: FastifyPluginAsync<BalloonFontRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: BalloonFontRoutesOptions
) => {
  const service = opts.balloonFontService ?? new BalloonFontService(opts.db);

  /**
   * GET /api/v1/reader/balloon-font/profile/:seriesId
   * Retrieves active profile with ETag caching
   */
  fastify.get<{
    Params: { seriesId: string };
  }>('/api/v1/reader/balloon-font/profile/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;

    if (!seriesId || seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid or missing seriesId parameter',
      });
    }

    const profile = service.getProfile(seriesId);
    const etag = computeBalloonFontEtag(
      profile.seriesId,
      profile.scalingMode,
      profile.minFontSizePx,
      profile.maxFontSizePx,
      profile.targetDensityRatio,
      profile.isFuriganaPreserved,
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
   * POST /api/v1/reader/balloon-font/profile
   * Saves or updates dialogue balloon font profile
   */
  fastify.post<{
    Body: {
      seriesId: string;
      scalingMode?: FontScalingMode;
      minFontSizePx?: number;
      maxFontSizePx?: number;
      targetDensityRatio?: number;
      isFuriganaPreserved?: boolean;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/balloon-font/profile', async (request, reply) => {
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
      scalingMode: body.scalingMode ?? 'comfort_legibility',
      minFontSizePx: body.minFontSizePx ?? 12,
      maxFontSizePx: body.maxFontSizePx ?? 28,
      targetDensityRatio: body.targetDensityRatio ?? 0.65,
      isFuriganaPreserved: body.isFuriganaPreserved ?? true,
      isEnabled: body.isEnabled ?? true,
    });

    return reply.status(200).send({ success: true, profile: updated });
  });

  /**
   * POST /api/v1/reader/balloon-font/calculate
   * Real-time zero-allocation font scaling evaluation
   */
  fastify.post<{
    Body: {
      balloonWidth?: number;
      balloonHeight?: number;
      textLength?: number;
      viewportWidth?: number;
      viewportHeight?: number;
      minFontSizePx?: number;
      maxFontSizePx?: number;
      targetDensityRatio?: number;
      isFuriganaPreserved?: boolean;
      mode?: FontScalingMode;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/balloon-font/calculate', async (request, reply) => {
    const body = request.body ?? {};

    const result = calculateBalloonFontScale(
      body.balloonWidth ?? 240,
      body.balloonHeight ?? 180,
      body.textLength ?? 32,
      body.viewportWidth ?? 1280,
      body.viewportHeight ?? 720,
      body.minFontSizePx ?? 12,
      body.maxFontSizePx ?? 28,
      body.targetDensityRatio ?? 0.65,
      body.isFuriganaPreserved ?? true,
      body.mode ?? 'comfort_legibility',
      body.isEnabled ?? true
    );

    return reply.status(200).send({
      success: true,
      result,
    });
  });

  /**
   * GET /api/v1/reader/balloon-font/presets
   * Retrieves predefined dialogue font scaling presets
   */
  fastify.get('/api/v1/reader/balloon-font/presets', async (_request, reply) => {
    return reply.status(200).send({
      success: true,
      presets: service.getPresets(),
    });
  });
};
