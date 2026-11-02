/**
 * KuraScroll - Sprint 105: Chapter Seam Fastify Routes
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  ChapterSeamService,
  ChapterSeamProfile,
  DecelerationMode,
  calculateChapterSeamKinematics,
  CHAPTER_SEAM_PRESETS,
} from '../services/chapter-seam-service.js';

export interface ChapterSeamRoutesOptions {
  db: DatabaseInstance;
  chapterSeamService?: ChapterSeamService;
}

export function computeChapterSeamEtag(
  seriesId: string,
  decelerationMode: string,
  seamThresholdPx: number,
  dampingFactor: number,
  preBakePanels: number,
  isMagneticSnap: boolean,
  isEnabled: boolean,
  updatedAt: number
): string {
  return `"cs-${seriesId}-${decelerationMode}-${seamThresholdPx}-${dampingFactor}-${preBakePanels}-${isMagneticSnap ? 1 : 0}-${isEnabled ? 1 : 0}-${updatedAt}"`;
}

export const chapterSeamRoutes: FastifyPluginAsync<ChapterSeamRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: ChapterSeamRoutesOptions
) => {
  const service = opts.chapterSeamService ?? new ChapterSeamService(opts.db);

  /**
   * GET /api/v1/reader/chapter-seam/profile/:seriesId
   * Retrieves active profile with ETag caching
   */
  fastify.get<{
    Params: { seriesId: string };
  }>('/api/v1/reader/chapter-seam/profile/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;

    if (!seriesId || seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid or missing seriesId parameter',
      });
    }

    const profile = service.getProfile(seriesId);
    const etag = computeChapterSeamEtag(
      profile.seriesId,
      profile.decelerationMode,
      profile.seamThresholdPx,
      profile.dampingFactor,
      profile.preBakePanels,
      profile.isMagneticSnap,
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
   * POST /api/v1/reader/chapter-seam/profile
   * Saves or updates seam deceleration profile
   */
  fastify.post<{
    Body: {
      seriesId: string;
      decelerationMode?: DecelerationMode;
      seamThresholdPx?: number;
      dampingFactor?: number;
      preBakePanels?: number;
      isMagneticSnap?: boolean;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/chapter-seam/profile', async (request, reply) => {
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
      decelerationMode: body.decelerationMode ?? 'smooth_continuous',
      seamThresholdPx: body.seamThresholdPx ?? 160,
      dampingFactor: body.dampingFactor ?? 0.85,
      preBakePanels: body.preBakePanels ?? 4,
      isMagneticSnap: body.isMagneticSnap ?? true,
      isEnabled: body.isEnabled ?? true,
    });

    return reply.status(200).send({ success: true, profile: updated });
  });

  /**
   * POST /api/v1/reader/chapter-seam/calculate
   * Real-time zero-allocation kinetic seam calculation
   */
  fastify.post<{
    Body: {
      currentVelocity?: number;
      distanceToSeamPx?: number;
      seamThresholdPx?: number;
      dampingFactor?: number;
      preBakePanels?: number;
      isMagneticSnap?: boolean;
      mode?: DecelerationMode;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/chapter-seam/calculate', async (request, reply) => {
    const body = request.body ?? {};

    const result = calculateChapterSeamKinematics(
      body.currentVelocity ?? 0,
      body.distanceToSeamPx ?? 500,
      body.seamThresholdPx ?? 160,
      body.dampingFactor ?? 0.85,
      body.preBakePanels ?? 4,
      body.isMagneticSnap ?? true,
      body.mode ?? 'smooth_continuous',
      body.isEnabled ?? true
    );

    return reply.status(200).send({
      success: true,
      result,
    });
  });

  /**
   * GET /api/v1/reader/chapter-seam/presets
   * Retrieves predefined chapter seam presets
   */
  fastify.get('/api/v1/reader/chapter-seam/presets', async (_request, reply) => {
    return reply.status(200).send({
      success: true,
      presets: service.getPresets(),
    });
  });
};
