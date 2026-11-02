/**
 * KuraScroll - Sprint 90: Bi-Directional Manga & Webtoon Continuous Infinite History Scrubber & Visual Heatmap Tape Fastify Routes
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  HistoryScrubberService,
  HistoryScrubberProfile,
  ScrubberMode,
  SCRUBBER_MODE_CONFIGS,
} from '../services/history-scrubber-service.js';

export interface HistoryScrubberRoutesOptions {
  db: DatabaseInstance;
  historyScrubberService?: HistoryScrubberService;
}

export function computeHistoryScrubberEtag(
  seriesId: string,
  scrubberMode: string,
  tapeThicknessPx: number,
  heatmapIntensity: number,
  velocityMultiplier: number,
  isSnapToChapter: boolean,
  isEnabled: boolean,
  updatedAt: number
): string {
  return `"hs-${seriesId}-${scrubberMode}-${tapeThicknessPx}-${heatmapIntensity}-${velocityMultiplier}-${isSnapToChapter ? 1 : 0}-${isEnabled ? 1 : 0}-${updatedAt}"`;
}

export const historyScrubberRoutes: FastifyPluginAsync<HistoryScrubberRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: HistoryScrubberRoutesOptions
) => {
  const service = opts.historyScrubberService ?? new HistoryScrubberService(opts.db);

  /**
   * GET /api/v1/reader/history-scrubber/profile/:seriesId
   * Retrieves active profile with ETag caching
   */
  fastify.get<{
    Params: { seriesId: string };
  }>('/api/v1/reader/history-scrubber/profile/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;

    if (!seriesId || seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid seriesId parameter',
      });
    }

    const profile = service.getProfile(seriesId);
    const etag = computeHistoryScrubberEtag(
      profile.seriesId,
      profile.scrubberMode,
      profile.tapeThicknessPx,
      profile.heatmapIntensity,
      profile.velocityMultiplier,
      profile.isSnapToChapter,
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
   * POST /api/v1/reader/history-scrubber/profile
   * Saves or updates a history scrubber profile
   */
  fastify.post<{
    Body: {
      seriesId: string;
      scrubberMode?: ScrubberMode;
      tapeThicknessPx?: number;
      heatmapIntensity?: number;
      velocityMultiplier?: number;
      isSnapToChapter?: boolean;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/history-scrubber/profile', async (request, reply) => {
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
      scrubberMode: body.scrubberMode ?? current.scrubberMode,
      tapeThicknessPx: body.tapeThicknessPx ?? current.tapeThicknessPx,
      heatmapIntensity: body.heatmapIntensity ?? current.heatmapIntensity,
      velocityMultiplier: body.velocityMultiplier ?? current.velocityMultiplier,
      isSnapToChapter: body.isSnapToChapter !== undefined ? body.isSnapToChapter : current.isSnapToChapter,
      isEnabled: body.isEnabled !== undefined ? body.isEnabled : current.isEnabled,
      updatedAt: Date.now(),
    });

    return reply.status(200).send({ success: true, profile: updated });
  });

  /**
   * POST /api/v1/reader/history-scrubber/project-tape
   * Calculates kinematic projection along the continuous tape in sub-20 microseconds
   */
  fastify.post<{
    Body: {
      totalItems?: number;
      currentIndex?: number;
      tapeLengthPx?: number;
      mode?: ScrubberMode;
      snapInterval?: number;
    };
  }>('/api/v1/reader/history-scrubber/project-tape', async (request, reply) => {
    const { totalItems, currentIndex, tapeLengthPx, mode, snapInterval } = request.body || {};

    const result = service.calculateTapeProjection(
      totalItems ?? 100,
      currentIndex ?? 0,
      tapeLengthPx ?? 1200,
      mode ?? 'webtoon_continuous',
      snapInterval ?? 0
    );

    return reply.status(200).send({ success: true, result });
  });

  /**
   * GET /api/v1/reader/history-scrubber/presets
   * Lists predefined scrubber modes
   */
  fastify.get('/api/v1/reader/history-scrubber/presets', async (_request, reply) => {
    return reply.status(200).send({
      success: true,
      presets: SCRUBBER_MODE_CONFIGS,
    });
  });
};
