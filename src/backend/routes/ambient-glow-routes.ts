/**
 * KuraScroll - Sprint 92: Adaptive Ambient Screen-Glow Dispersion & Border Bleed Light Fastify Routes
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  AmbientGlowService,
  AmbientGlowProfile,
  GlowMode,
  AMBIENT_GLOW_CONFIGS,
} from '../services/ambient-glow-service.js';

export interface AmbientGlowRoutesOptions {
  db: DatabaseInstance;
  ambientGlowService?: AmbientGlowService;
}

export function computeAmbientGlowEtag(
  seriesId: string,
  glowMode: string,
  glowSpreadPx: number,
  glowOpacity: number,
  featherSmoothness: number,
  isEnabled: boolean,
  updatedAt: number
): string {
  return `"ag-${seriesId}-${glowMode}-${glowSpreadPx}-${glowOpacity}-${featherSmoothness}-${isEnabled ? 1 : 0}-${updatedAt}"`;
}

export const ambientGlowRoutes: FastifyPluginAsync<AmbientGlowRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: AmbientGlowRoutesOptions
) => {
  const service = opts.ambientGlowService ?? new AmbientGlowService(opts.db);

  /**
   * GET /api/v1/reader/ambient-glow/profile/:seriesId
   * Retrieves active profile with ETag caching
   */
  fastify.get<{
    Params: { seriesId: string };
  }>('/api/v1/reader/ambient-glow/profile/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;

    if (!seriesId || seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid seriesId parameter',
      });
    }

    const profile = service.getProfile(seriesId);
    const etag = computeAmbientGlowEtag(
      profile.seriesId,
      profile.glowMode,
      profile.glowSpreadPx,
      profile.glowOpacity,
      profile.featherSmoothness,
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
   * POST /api/v1/reader/ambient-glow/profile
   * Saves or updates an ambient glow profile
   */
  fastify.post<{
    Body: {
      seriesId: string;
      glowMode?: GlowMode;
      glowSpreadPx?: number;
      glowOpacity?: number;
      featherSmoothness?: number;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/ambient-glow/profile', async (request, reply) => {
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
      glowMode: body.glowMode ?? current.glowMode,
      glowSpreadPx: body.glowSpreadPx ?? current.glowSpreadPx,
      glowOpacity: body.glowOpacity ?? current.glowOpacity,
      featherSmoothness: body.featherSmoothness ?? current.featherSmoothness,
      isEnabled: body.isEnabled !== undefined ? body.isEnabled : current.isEnabled,
      updatedAt: Date.now(),
    });

    return reply.status(200).send({ success: true, profile: updated });
  });

  /**
   * POST /api/v1/reader/ambient-glow/calculate-gradients
   * Calculates ambient dispersion gradients in sub-20 microseconds
   */
  fastify.post<{
    Body: {
      glowMode?: GlowMode;
      spreadPx?: number;
      opacity?: number;
      smoothness?: number;
      topRgb?: string;
      bottomRgb?: string;
      leftRgb?: string;
      rightRgb?: string;
    };
  }>('/api/v1/reader/ambient-glow/calculate-gradients', async (request, reply) => {
    const { glowMode, spreadPx, opacity, smoothness, topRgb, bottomRgb, leftRgb, rightRgb } = request.body || {};

    const result = service.calculateGlowDispersionGradients(
      glowMode ?? 'cinematic_reactive',
      spreadPx ?? 64,
      opacity ?? 0.45,
      smoothness ?? 1.20,
      topRgb ?? '40, 40, 50',
      bottomRgb ?? '30, 30, 40',
      leftRgb ?? '35, 35, 45',
      rightRgb ?? '35, 35, 45'
    );

    return reply.status(200).send({ success: true, result });
  });

  /**
   * GET /api/v1/reader/ambient-glow/presets
   * Lists predefined ambient glow modes
   */
  fastify.get('/api/v1/reader/ambient-glow/presets', async (_request, reply) => {
    return reply.status(200).send({
      success: true,
      presets: AMBIENT_GLOW_CONFIGS,
    });
  });
};
