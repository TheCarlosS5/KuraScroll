/**
 * KuraScroll Dynamic Halftone Screentone & Vintage Paper Aging Fastify Routes
 * Sprint 77 - Manga Screentone & Tankōbon Aging Simulator
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  PageHalftoneService,
  PageHalftoneProfile,
  HalftonePresetName,
} from '../services/page-halftone-service.js';
import crypto from 'node:crypto';

export interface PageHalftoneRoutesOptions {
  db: DatabaseInstance;
  pageHalftoneService?: PageHalftoneService;
}

export const pageHalftoneRoutes: FastifyPluginAsync<PageHalftoneRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: PageHalftoneRoutesOptions
) => {
  const service = opts.pageHalftoneService ?? new PageHalftoneService(opts.db);

  /**
   * GET /api/v1/halftone/profile/:seriesId
   * Retrieves active halftone profile for a series or chapter with ETag caching
   */
  fastify.get<{
    Params: { seriesId: string };
    Querystring: { chapterId?: string };
  }>('/api/v1/halftone/profile/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;
    const { chapterId } = request.query;

    if (!seriesId || seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid seriesId parameter',
      });
    }

    const profile = service.getProfile(seriesId, chapterId);
    const payload = JSON.stringify({ success: true, profile });
    const etag = `"${crypto.createHash('md5').update(payload).digest('hex')}"`;

    if (request.headers['if-none-match'] === etag) {
      return reply.status(304).send();
    }

    reply.header('Cache-Control', 'private, max-age=60, must-revalidate');
    reply.header('ETag', etag);
    return reply.status(200).type('application/json').send(payload);
  });

  /**
   * POST /api/v1/halftone/profile
   * Saves or updates a halftone profile
   */
  fastify.post<{
    Body: {
      seriesId: string;
      chapterId?: string | null;
      presetName?: HalftonePresetName;
      dotPitchLpi?: number;
      dotAngleDeg?: number;
      dotIntensity?: number;
      paperAgePct?: number;
      foxingIntensity?: number;
      isEnabled?: boolean;
    };
  }>('/api/v1/halftone/profile', async (request, reply) => {
    const body = request.body;

    if (!body || !body.seriesId || body.seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'seriesId is required',
      });
    }

    const saved = service.upsertProfile({
      seriesId: body.seriesId,
      chapterId: body.chapterId ?? null,
      presetName: body.presetName ?? 'pristine',
      dotPitchLpi: body.dotPitchLpi ?? 60,
      dotAngleDeg: body.dotAngleDeg ?? 45.0,
      dotIntensity: body.dotIntensity ?? 0.0,
      paperAgePct: body.paperAgePct ?? 0.0,
      foxingIntensity: body.foxingIntensity ?? 0.0,
      isEnabled: body.isEnabled !== false,
    });

    return reply.status(200).send({ success: true, profile: saved });
  });

  /**
   * POST /api/v1/halftone/calculate-matrix
   * Fast dot matrix and paper aging parameter calculation (SLA 41 < 20µs)
   */
  fastify.post<{
    Body: {
      profile?: Partial<PageHalftoneProfile>;
      seriesId?: string;
      chapterId?: string;
    };
  }>('/api/v1/halftone/calculate-matrix', async (request, reply) => {
    const { profile: explicitProfile, seriesId, chapterId } = request.body || {};

    const profile = explicitProfile ?? (seriesId ? service.getProfile(seriesId, chapterId) : {});
    const result = PageHalftoneService.calculateHalftoneMatrix(profile);

    return reply.status(200).send({
      success: true,
      result,
    });
  });
};
