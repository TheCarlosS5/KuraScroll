/**
 * KuraScroll - Sprint 93: Bi-Temporal Gaze & Velocity Dynamic Page Curl & Turn Fastify Routes
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  PageCurlService,
  PageCurlProfile,
  CurlPreset,
  PAGE_CURL_PRESETS,
} from '../services/page-curl-service.js';

export interface PageCurlRoutesOptions {
  db: DatabaseInstance;
  pageCurlService?: PageCurlService;
}

export function computePageCurlEtag(
  seriesId: string,
  curlPreset: string,
  paperStiffness: number,
  maxCurlAngleDeg: number,
  shadowDepth: number,
  isPeelCornerEnabled: boolean,
  isEnabled: boolean,
  updatedAt: number
): string {
  return `"pc-${seriesId}-${curlPreset}-${paperStiffness}-${maxCurlAngleDeg}-${shadowDepth}-${isPeelCornerEnabled ? 1 : 0}-${isEnabled ? 1 : 0}-${updatedAt}"`;
}

export const pageCurlRoutes: FastifyPluginAsync<PageCurlRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: PageCurlRoutesOptions
) => {
  const service = opts.pageCurlService ?? new PageCurlService(opts.db);

  /**
   * GET /api/v1/reader/page-curl/profile/:seriesId
   * Retrieves active profile with ETag caching
   */
  fastify.get<{
    Params: { seriesId: string };
  }>('/api/v1/reader/page-curl/profile/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;

    if (!seriesId || seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid seriesId parameter',
      });
    }

    const profile = service.getProfile(seriesId);
    const etag = computePageCurlEtag(
      profile.seriesId,
      profile.curlPreset,
      profile.paperStiffness,
      profile.maxCurlAngleDeg,
      profile.shadowDepth,
      profile.isPeelCornerEnabled,
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
   * POST /api/v1/reader/page-curl/profile
   * Saves or updates a page curl profile
   */
  fastify.post<{
    Body: {
      seriesId: string;
      curlPreset?: CurlPreset;
      paperStiffness?: number;
      maxCurlAngleDeg?: number;
      shadowDepth?: number;
      isPeelCornerEnabled?: boolean;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/page-curl/profile', async (request, reply) => {
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
      curlPreset: body.curlPreset ?? current.curlPreset,
      paperStiffness: body.paperStiffness ?? current.paperStiffness,
      maxCurlAngleDeg: body.maxCurlAngleDeg ?? current.maxCurlAngleDeg,
      shadowDepth: body.shadowDepth ?? current.shadowDepth,
      isPeelCornerEnabled: body.isPeelCornerEnabled !== undefined ? body.isPeelCornerEnabled : current.isPeelCornerEnabled,
      isEnabled: body.isEnabled !== undefined ? body.isEnabled : current.isEnabled,
      updatedAt: Date.now(),
    });

    return reply.status(200).send({ success: true, profile: updated });
  });

  /**
   * POST /api/v1/reader/page-curl/calculate-transform
   * Calculates 2.5D page curl transform in sub-20 microseconds
   */
  fastify.post<{
    Body: {
      dragProgress?: number;
      velocityPx?: number;
      stiffness?: number;
      maxAngleDeg?: number;
      shadowDepth?: number;
      isCornerPeel?: boolean;
      isRtl?: boolean;
      preset?: CurlPreset;
    };
  }>('/api/v1/reader/page-curl/calculate-transform', async (request, reply) => {
    const {
      dragProgress,
      velocityPx,
      stiffness,
      maxAngleDeg,
      shadowDepth,
      isCornerPeel,
      isRtl,
      preset,
    } = request.body || {};

    const result = service.calculatePageCurlTransform(
      dragProgress ?? 0.0,
      velocityPx ?? 0,
      stiffness ?? 0.85,
      maxAngleDeg ?? 45.0,
      shadowDepth ?? 0.40,
      isCornerPeel ?? true,
      isRtl ?? true,
      preset ?? 'tankobon_stiff'
    );

    return reply.status(200).send({ success: true, result });
  });

  /**
   * GET /api/v1/reader/page-curl/presets
   * Lists predefined page curl paper profiles
   */
  fastify.get('/api/v1/reader/page-curl/presets', async (_request, reply) => {
    return reply.status(200).send({
      success: true,
      presets: PAGE_CURL_PRESETS,
    });
  });
};
