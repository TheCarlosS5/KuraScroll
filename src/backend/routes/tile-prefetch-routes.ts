/**
 * KuraScroll - Sprint 117: Predictive Subpixel Canvas Tile Cache Prefetcher & LRU Texture Swapper Routes
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  TilePrefetchService,
  ReadingFlow,
  calculateTilePrefetchDecision,
  getPrefetchRingBufferState,
  TILE_PREFETCH_PRESETS,
} from '../services/tile-prefetch-service.js';

export interface TilePrefetchRoutesOptions {
  db: DatabaseInstance;
  tilePrefetchService?: TilePrefetchService;
}

export function computeTilePrefetchEtag(
  seriesId: string,
  readingFlow: string,
  predictionHorizonMs: number,
  recencyTauMs: number,
  maxPrefetchTiles: number,
  hysteresisThreshold: number,
  isEnabled: boolean,
  updatedAt: number
): string {
  return `"tp-${seriesId}-${readingFlow}-${predictionHorizonMs}-${recencyTauMs}-${maxPrefetchTiles}-${hysteresisThreshold}-${isEnabled ? 1 : 0}-${updatedAt}"`;
}

export const tilePrefetchRoutes: FastifyPluginAsync<TilePrefetchRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: TilePrefetchRoutesOptions
) => {
  const service = opts.tilePrefetchService ?? new TilePrefetchService(opts.db);

  /**
   * GET /api/v1/reader/tile-prefetch/presets
   * Retrieves all available prefetch profiles / presets
   */
  fastify.get('/api/v1/reader/tile-prefetch/presets', async (_request, reply) => {
    return reply.status(200).send({
      success: true,
      presets: TILE_PREFETCH_PRESETS,
    });
  });

  /**
   * GET /api/v1/reader/tile-prefetch/profile/:seriesId
   * Retrieves active profile with ETag caching
   */
  fastify.get<{
    Params: { seriesId: string };
  }>('/api/v1/reader/tile-prefetch/profile/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;

    if (!seriesId || seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid or missing seriesId parameter',
      });
    }

    const profile = service.getProfile(seriesId);
    const etag = computeTilePrefetchEtag(
      profile.seriesId,
      profile.readingFlow,
      profile.predictionHorizonMs,
      profile.recencyTauMs,
      profile.maxPrefetchTiles,
      profile.hysteresisThreshold,
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
   * POST /api/v1/reader/tile-prefetch/profile
   * Saves or updates tile prefetch profile
   */
  fastify.post<{
    Body: {
      seriesId: string;
      readingFlow?: ReadingFlow;
      predictionHorizonMs?: number;
      recencyTauMs?: number;
      maxPrefetchTiles?: number;
      hysteresisThreshold?: number;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/tile-prefetch/profile', async (request, reply) => {
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
      readingFlow: body.readingFlow,
      predictionHorizonMs: body.predictionHorizonMs,
      recencyTauMs: body.recencyTauMs,
      maxPrefetchTiles: body.maxPrefetchTiles,
      hysteresisThreshold: body.hysteresisThreshold,
      isEnabled: body.isEnabled,
    });

    return reply.status(200).send({ success: true, profile: updated });
  });

  /**
   * POST /api/v1/reader/tile-prefetch/calculate
   * Real-time zero-allocation tile prefetch Markov calculation
   */
  fastify.post<{
    Body: {
      currentTileId: number;
      candidateTileId: number;
      transitionWeight: number;
      hysteresisThreshold?: number;
      isCandidatePinned?: boolean;
    };
  }>('/api/v1/reader/tile-prefetch/calculate', async (request, reply) => {
    const {
      currentTileId,
      candidateTileId,
      transitionWeight,
      hysteresisThreshold,
      isCandidatePinned,
    } = request.body ?? {};

    if (
      currentTileId === undefined ||
      candidateTileId === undefined ||
      transitionWeight === undefined
    ) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Missing required candidate or transition weight fields',
      });
    }

    const result = calculateTilePrefetchDecision(
      currentTileId,
      candidateTileId,
      transitionWeight,
      hysteresisThreshold,
      isCandidatePinned
    );

    return reply.status(200).send({
      success: true,
      result,
    });
  });

  /**
   * GET /api/v1/reader/tile-prefetch/ring-buffer
   * Retrieves live ring buffer state & telemetry
   */
  fastify.get('/api/v1/reader/tile-prefetch/ring-buffer', async (_request, reply) => {
    const state = getPrefetchRingBufferState();
    return reply.status(200).send({
      success: true,
      ringBuffer: state,
    });
  });
};
