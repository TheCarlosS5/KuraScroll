/**
 * KuraScroll - Sprint 96: Bi-Directional Dual-Page Gutters & Crease Shadow Fastify Routes
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  CreaseShadowService,
  CreaseShadowProfile,
  SpreadBindingMode,
  CREASE_SHADOW_PRESETS,
} from '../services/crease-shadow-service.js';

export interface CreaseShadowRoutesOptions {
  db: DatabaseInstance;
  creaseShadowService?: CreaseShadowService;
}

export function computeCreaseShadowEtag(
  seriesId: string,
  spreadBindingMode: string,
  spineShadowIntensity: number,
  gutterWidthPx: number,
  asymmetryRatio: number,
  isRtl: boolean,
  isEnabled: boolean,
  updatedAt: number
): string {
  return `"cs-${seriesId}-${spreadBindingMode}-${spineShadowIntensity}-${gutterWidthPx}-${asymmetryRatio}-${isRtl ? 1 : 0}-${isEnabled ? 1 : 0}-${updatedAt}"`;
}

export const creaseShadowRoutes: FastifyPluginAsync<CreaseShadowRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: CreaseShadowRoutesOptions
) => {
  const service = opts.creaseShadowService ?? new CreaseShadowService(opts.db);

  /**
   * GET /api/v1/reader/crease-shadow/profile/:seriesId
   * Retrieves active profile with ETag caching
   */
  fastify.get<{
    Params: { seriesId: string };
  }>('/api/v1/reader/crease-shadow/profile/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;

    if (!seriesId || seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid seriesId parameter',
      });
    }

    const profile = service.getProfile(seriesId);
    const etag = computeCreaseShadowEtag(
      profile.seriesId,
      profile.spreadBindingMode,
      profile.spineShadowIntensity,
      profile.gutterWidthPx,
      profile.asymmetryRatio,
      profile.isRtl,
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
   * POST /api/v1/reader/crease-shadow/profile
   * Saves or updates a crease shadow profile
   */
  fastify.post<{
    Body: {
      seriesId: string;
      spreadBindingMode?: SpreadBindingMode;
      spineShadowIntensity?: number;
      gutterWidthPx?: number;
      asymmetryRatio?: number;
      isRtl?: boolean;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/crease-shadow/profile', async (request, reply) => {
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
      spreadBindingMode: body.spreadBindingMode ?? current.spreadBindingMode,
      spineShadowIntensity: body.spineShadowIntensity ?? current.spineShadowIntensity,
      gutterWidthPx: body.gutterWidthPx ?? current.gutterWidthPx,
      asymmetryRatio: body.asymmetryRatio ?? current.asymmetryRatio,
      isRtl: body.isRtl !== undefined ? body.isRtl : current.isRtl,
      isEnabled: body.isEnabled !== undefined ? body.isEnabled : current.isEnabled,
      updatedAt: Date.now(),
    });

    return reply.status(200).send({ success: true, profile: updated });
  });

  /**
   * POST /api/v1/reader/crease-shadow/calculate-crease-shadow
   * Synthesizes bilateral spine crease shadow gradients in sub-20 microseconds
   */
  fastify.post<{
    Body: {
      progressRatio?: number;
      intensity?: number;
      gutterWidthPx?: number;
      asymmetry?: number;
      isRtl?: boolean;
      mode?: SpreadBindingMode;
    };
  }>('/api/v1/reader/crease-shadow/calculate-crease-shadow', async (request, reply) => {
    const {
      progressRatio,
      intensity,
      gutterWidthPx,
      asymmetry,
      isRtl,
      mode,
    } = request.body || {};

    const result = service.calculateCreaseShadowParams(
      progressRatio ?? 0.50,
      intensity ?? 0.65,
      gutterWidthPx ?? 24,
      asymmetry ?? 0.50,
      isRtl ?? true,
      mode ?? 'tankobon_tight'
    );

    return reply.status(200).send({ success: true, result });
  });

  /**
   * GET /api/v1/reader/crease-shadow/presets
   * Lists predefined crease shadow spread binding modes
   */
  fastify.get('/api/v1/reader/crease-shadow/presets', async (_request, reply) => {
    return reply.status(200).send({
      success: true,
      presets: CREASE_SHADOW_PRESETS,
    });
  });
};
