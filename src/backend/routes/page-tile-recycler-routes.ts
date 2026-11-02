/**
 * KuraScroll - Sprint 101: Page Tile Recycler Fastify Routes
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  PageTileRecyclerService,
  PageBufferProfile,
  SlotRecyclingStrategy,
  PageTileSlot,
  calculatePageTileRecyclingMatrix,
  PAGE_BUFFER_PRESETS,
} from '../services/page-tile-recycler-service.js';

export interface PageTileRecyclerRoutesOptions {
  db: DatabaseInstance;
  pageTileRecyclerService?: PageTileRecyclerService;
}

export function computePageBufferEtag(
  seriesId: string,
  ringCapacity: number,
  forwardLookahead: number,
  backwardLookahead: number,
  slotRecyclingStrategy: string,
  zeroCopySliceEnabled: boolean,
  maxMemoryPoolBytes: number,
  updatedAt: number
): string {
  return `"pb-${seriesId}-${ringCapacity}-${forwardLookahead}-${backwardLookahead}-${slotRecyclingStrategy}-${zeroCopySliceEnabled ? 1 : 0}-${maxMemoryPoolBytes}-${updatedAt}"`;
}

export const pageTileRecyclerRoutes: FastifyPluginAsync<PageTileRecyclerRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: PageTileRecyclerRoutesOptions
) => {
  const service = opts.pageTileRecyclerService ?? new PageTileRecyclerService(opts.db);

  /**
   * GET /api/v1/reader/page-buffer/profile/:seriesId
   * Retrieves active buffer profile with ETag caching
   */
  fastify.get<{
    Params: { seriesId: string };
  }>('/api/v1/reader/page-buffer/profile/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;

    if (!seriesId || seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid or missing seriesId parameter',
      });
    }

    const profile = service.getProfile(seriesId);
    const etag = computePageBufferEtag(
      profile.seriesId,
      profile.ringCapacity,
      profile.forwardLookahead,
      profile.backwardLookahead,
      profile.slotRecyclingStrategy,
      profile.zeroCopySliceEnabled,
      profile.maxMemoryPoolBytes,
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
   * POST /api/v1/reader/page-buffer/profile
   * Saves or updates page buffer profile
   */
  fastify.post<{
    Body: {
      seriesId: string;
      ringCapacity?: number;
      forwardLookahead?: number;
      backwardLookahead?: number;
      slotRecyclingStrategy?: SlotRecyclingStrategy;
      zeroCopySliceEnabled?: boolean;
      maxMemoryPoolBytes?: number;
    };
  }>('/api/v1/reader/page-buffer/profile', async (request, reply) => {
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
      ringCapacity: body.ringCapacity,
      forwardLookahead: body.forwardLookahead,
      backwardLookahead: body.backwardLookahead,
      slotRecyclingStrategy: body.slotRecyclingStrategy,
      zeroCopySliceEnabled: body.zeroCopySliceEnabled,
      maxMemoryPoolBytes: body.maxMemoryPoolBytes,
    });

    return reply.status(200).send({ success: true, profile: updated });
  });

  /**
   * POST /api/v1/reader/page-buffer/calculate-recycling-matrix
   * Fast zero-allocation endpoint to calculate recycling targets and zero-copy slicing
   */
  fastify.post<{
    Body: {
      currentPageIndex: number;
      totalPages: number;
      ringCapacity?: number;
      forwardLookahead?: number;
      backwardLookahead?: number;
      slotRecyclingStrategy?: SlotRecyclingStrategy;
      activeSlots?: PageTileSlot[];
      direction?: 'forward' | 'backward';
      zeroCopySliceEnabled?: boolean;
      pageSizeBytes?: number;
    };
  }>('/api/v1/reader/page-buffer/calculate-recycling-matrix', async (request, reply) => {
    const body = request.body;
    if (body.currentPageIndex === undefined || body.totalPages === undefined) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Missing required parameters: currentPageIndex and totalPages',
      });
    }

    const result = calculatePageTileRecyclingMatrix(
      body.currentPageIndex,
      body.totalPages,
      body.ringCapacity ?? 7,
      body.forwardLookahead ?? 3,
      body.backwardLookahead ?? 2,
      body.slotRecyclingStrategy ?? 'circular_lru',
      body.activeSlots,
      body.direction ?? 'forward',
      body.zeroCopySliceEnabled ?? true,
      body.pageSizeBytes ?? 1048576
    );

    return reply.status(200).send({
      success: true,
      matrix: result,
    });
  });

  /**
   * GET /api/v1/reader/page-buffer/presets
   * Retrieves predefined performance presets
   */
  fastify.get('/api/v1/reader/page-buffer/presets', async (_request, reply) => {
    return reply.status(200).send({
      success: true,
      presets: service.getPresets(),
    });
  });
};
