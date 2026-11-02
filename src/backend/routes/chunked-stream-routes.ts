/**
 * KuraScroll Progressive Image Decompression & Chunked Bitstream Fastify Routes
 * Sprint 87 - ChunkedStream Pipeline
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  ChunkedStreamService,
  ChunkedStreamProfile,
  CHUNKED_STREAM_PRESETS,
} from '../services/chunked-stream-service.js';

export interface ChunkedStreamRoutesOptions {
  db: DatabaseInstance;
  chunkedStreamService?: ChunkedStreamService;
}

export function computeChunkedStreamEtag(
  seriesId: string,
  chunkHeightPx: number,
  bitstreamQuality: number,
  progressivePassCount: number,
  idleSliceBudgetMs: number,
  isEnabled: boolean,
  updatedAt: number
): string {
  return `"cs-${seriesId}-${chunkHeightPx}-${bitstreamQuality}-${progressivePassCount}-${idleSliceBudgetMs}-${isEnabled ? 1 : 0}-${updatedAt}"`;
}

export const chunkedStreamRoutes: FastifyPluginAsync<ChunkedStreamRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: ChunkedStreamRoutesOptions
) => {
  const service = opts.chunkedStreamService ?? new ChunkedStreamService(opts.db);

  /**
   * GET /api/v1/reader/chunked-stream/profile/:seriesId
   * Retrieves active profile with ETag caching
   */
  fastify.get<{
    Params: { seriesId: string };
  }>('/api/v1/reader/chunked-stream/profile/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;

    if (!seriesId || seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid seriesId parameter',
      });
    }

    const profile = service.getProfile(seriesId);
    const etag = computeChunkedStreamEtag(
      profile.seriesId,
      profile.chunkHeightPx,
      profile.bitstreamQuality,
      profile.progressivePassCount,
      profile.idleSliceBudgetMs,
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
   * POST /api/v1/reader/chunked-stream/profile
   * Saves or updates a chunked stream profile
   */
  fastify.post<{
    Body: {
      seriesId: string;
      chunkHeightPx?: number;
      bitstreamQuality?: number;
      progressivePassCount?: number;
      idleSliceBudgetMs?: number;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/chunked-stream/profile', async (request, reply) => {
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
      chunkHeightPx: body.chunkHeightPx ?? current.chunkHeightPx,
      bitstreamQuality: body.bitstreamQuality ?? current.bitstreamQuality,
      progressivePassCount: body.progressivePassCount ?? current.progressivePassCount,
      idleSliceBudgetMs: body.idleSliceBudgetMs ?? current.idleSliceBudgetMs,
      isEnabled: body.isEnabled !== undefined ? body.isEnabled : current.isEnabled,
      updatedAt: Date.now(),
    });

    return reply.status(200).send({ success: true, profile: updated });
  });

  /**
   * POST /api/v1/reader/chunked-stream/calculate-slices
   * Calculates image chunk slices in sub-20 microseconds
   */
  fastify.post<{
    Body: {
      totalWidth: number;
      totalHeight: number;
      maxChunkDim?: number;
      bytesPerPixel?: number;
    };
  }>('/api/v1/reader/chunked-stream/calculate-slices', async (request, reply) => {
    const { totalWidth, totalHeight, maxChunkDim, bytesPerPixel } = request.body || {};

    if (totalWidth === undefined || totalHeight === undefined) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Missing totalWidth or totalHeight',
      });
    }

    const result = service.calculateImageChunkSlices(
      totalWidth,
      totalHeight,
      maxChunkDim ?? 1024,
      bytesPerPixel ?? 4
    );

    return reply.status(200).send({ success: true, result });
  });

  /**
   * GET /api/v1/reader/chunked-stream/presets
   * Lists predefined streaming presets
   */
  fastify.get('/api/v1/reader/chunked-stream/presets', async (_request, reply) => {
    return reply.status(200).send({
      success: true,
      presets: CHUNKED_STREAM_PRESETS,
    });
  });
};
