/**
 * KuraScroll - Sprint 109: Bi-Directional Multi-Channel Tactile Page Edge Bevel & Stack Thickness Hologram Synthesizer Routes
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  PageBevelService,
  PaperCaliperMode,
  BevelReadingDirection,
  calculatePageBevel,
  PAGE_BEVEL_PRESETS,
} from '../services/page-bevel-service.js';

export interface PageBevelRoutesOptions {
  db: DatabaseInstance;
  pageBevelService?: PageBevelService;
}

export function computePageBevelEtag(
  seriesId: string,
  paperCaliperMode: string,
  maxStackThicknessPx: number,
  pageCaliperUm: number,
  curvatureSagPct: number,
  edgeBevelShadingPct: number,
  readingDirection: string,
  isEnabled: boolean,
  updatedAt: number
): string {
  return `"pb-${seriesId}-${paperCaliperMode}-${maxStackThicknessPx}-${pageCaliperUm}-${curvatureSagPct}-${edgeBevelShadingPct}-${readingDirection}-${isEnabled ? 1 : 0}-${updatedAt}"`;
}

export const pageBevelRoutes: FastifyPluginAsync<PageBevelRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: PageBevelRoutesOptions
) => {
  const service = opts.pageBevelService ?? new PageBevelService(opts.db);

  /**
   * GET /api/v1/reader/page-bevel/profile/:seriesId
   * Retrieves active profile with ETag caching
   */
  fastify.get<{
    Params: { seriesId: string };
  }>('/api/v1/reader/page-bevel/profile/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;

    if (!seriesId || seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid or missing seriesId parameter',
      });
    }

    const profile = service.getProfile(seriesId);
    const etag = computePageBevelEtag(
      profile.seriesId,
      profile.paperCaliperMode,
      profile.maxStackThicknessPx,
      profile.pageCaliperUm,
      profile.curvatureSagPct,
      profile.edgeBevelShadingPct,
      profile.readingDirection,
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
   * POST /api/v1/reader/page-bevel/profile
   * Saves or updates page bevel profile
   */
  fastify.post<{
    Body: {
      seriesId: string;
      paperCaliperMode?: PaperCaliperMode;
      maxStackThicknessPx?: number;
      pageCaliperUm?: number;
      curvatureSagPct?: number;
      edgeBevelShadingPct?: number;
      readingDirection?: BevelReadingDirection;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/page-bevel/profile', async (request, reply) => {
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
      paperCaliperMode: body.paperCaliperMode,
      maxStackThicknessPx: body.maxStackThicknessPx,
      pageCaliperUm: body.pageCaliperUm,
      curvatureSagPct: body.curvatureSagPct,
      edgeBevelShadingPct: body.edgeBevelShadingPct,
      readingDirection: body.readingDirection,
      isEnabled: body.isEnabled,
    });

    return reply.status(200).send({ success: true, profile: updated });
  });

  /**
   * POST /api/v1/reader/page-bevel/calculate
   * Real-time zero-allocation page bevel calculation
   */
  fastify.post<{
    Body: {
      currentPage?: number;
      totalPages?: number;
      readingDirection?: BevelReadingDirection;
      maxStackThicknessPx?: number;
      pageCaliperUm?: number;
      curvatureSagPct?: number;
      edgeBevelShadingPct?: number;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/page-bevel/calculate', async (request, reply) => {
    const body = request.body ?? {};

    const result = calculatePageBevel(
      body.currentPage ?? 1,
      body.totalPages ?? 200,
      body.readingDirection ?? 'rtl',
      body.maxStackThicknessPx ?? 24,
      body.pageCaliperUm ?? 110.0,
      body.curvatureSagPct ?? 35,
      body.edgeBevelShadingPct ?? 40,
      body.isEnabled ?? true
    );

    return reply.status(200).send({
      success: true,
      result,
    });
  });

  /**
   * GET /api/v1/reader/page-bevel/presets
   * Retrieves predefined paper caliper presets
   */
  fastify.get('/api/v1/reader/page-bevel/presets', async (_request, reply) => {
    return reply.status(200).send({
      success: true,
      presets: service.getPresets(),
    });
  });
};
