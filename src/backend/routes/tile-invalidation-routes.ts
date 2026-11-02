/**
 * KuraScroll - Sprint 107: Bi-Temporal Frame-Paced Adaptive Micro-Tile Invalidator & Memory Cache Garbage Collector Routes
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  TileInvalidationService,
  TileCandidate,
  ViewportKinematics,
  TileInvalidationProfile,
  calculateTileInvalidation,
  TILE_INVALIDATION_PRESETS,
} from '../services/tile-invalidation-service.js';

export interface TileInvalidationRoutesOptions {
  db: DatabaseInstance;
  tileInvalidationService?: TileInvalidationService;
}

export function computeTileInvalidationEtag(
  seriesId: string,
  maxHeapMb: number,
  viewportMarginPx: number,
  warmMarginPx: number,
  evictionBudgetMs: number,
  isAutoGcEnabled: boolean,
  updatedAt: number
): string {
  return `"ti-${seriesId}-${maxHeapMb}-${viewportMarginPx}-${warmMarginPx}-${evictionBudgetMs}-${isAutoGcEnabled ? 1 : 0}-${updatedAt}"`;
}

export const tileInvalidationRoutes: FastifyPluginAsync<TileInvalidationRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: TileInvalidationRoutesOptions
) => {
  const service = opts.tileInvalidationService ?? new TileInvalidationService(opts.db);

  /**
   * GET /api/v1/reader/tile-invalidation/profile/:seriesId
   * Retrieves active profile with ETag caching
   */
  fastify.get<{
    Params: { seriesId: string };
  }>('/api/v1/reader/tile-invalidation/profile/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;

    if (!seriesId || seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid or missing seriesId parameter',
      });
    }

    const profile = service.getProfile(seriesId);
    const etag = computeTileInvalidationEtag(
      profile.seriesId,
      profile.maxHeapMb,
      profile.viewportMarginPx,
      profile.warmMarginPx,
      profile.evictionBudgetMs,
      profile.isAutoGcEnabled,
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
   * POST /api/v1/reader/tile-invalidation/profile
   * Saves or updates tile invalidation profile
   */
  fastify.post<{
    Body: {
      seriesId: string;
      maxHeapMb?: number;
      viewportMarginPx?: number;
      warmMarginPx?: number;
      evictionBudgetMs?: number;
      velocityWeight?: number;
      recencyWeight?: number;
      sizeWeight?: number;
      isAutoGcEnabled?: boolean;
    };
  }>('/api/v1/reader/tile-invalidation/profile', async (request, reply) => {
    const body = request.body;
    if (!body || !body.seriesId || body.seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Missing or empty seriesId',
      });
    }

    const updated = service.upsertProfile(body.seriesId, {
      maxHeapMb: body.maxHeapMb,
      viewportMarginPx: body.viewportMarginPx,
      warmMarginPx: body.warmMarginPx,
      evictionBudgetMs: body.evictionBudgetMs,
      velocityWeight: body.velocityWeight,
      recencyWeight: body.recencyWeight,
      sizeWeight: body.sizeWeight,
      isAutoGcEnabled: body.isAutoGcEnabled,
    });

    return reply.status(200).send({ success: true, profile: updated });
  });

  /**
   * POST /api/v1/reader/tile-invalidation/calculate
   * Real-time zero-allocation micro-tile invalidation evaluation
   */
  fastify.post<{
    Body: {
      tiles?: TileCandidate[];
      kinematics?: ViewportKinematics;
      profile?: Partial<TileInvalidationProfile>;
    };
  }>('/api/v1/reader/tile-invalidation/calculate', async (request, reply) => {
    const body = request.body ?? {};

    const tiles = body.tiles ?? [];
    const kinematics: ViewportKinematics = body.kinematics ?? {
      viewportX: 0,
      viewportY: 0,
      viewportWidth: 1280,
      viewportHeight: 720,
      velocityX: 0,
      velocityY: 0,
      nowEpochMs: Date.now(),
      currentHeapMb: 64,
    };

    const result = calculateTileInvalidation(tiles, kinematics, body.profile);

    return reply.status(200).send({
      success: true,
      result,
    });
  });

  /**
   * GET /api/v1/reader/tile-invalidation/presets
   * Retrieves predefined tile invalidation profiles
   */
  fastify.get('/api/v1/reader/tile-invalidation/presets', async (_request, reply) => {
    return reply.status(200).send({
      success: true,
      presets: service.getPresets(),
    });
  });
};
