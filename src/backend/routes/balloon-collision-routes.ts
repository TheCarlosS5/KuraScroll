/**
 * KuraScroll - Sprint 102: Balloon Collision Routes
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  BalloonCollisionService,
  BalloonCollisionProfile,
  AvoidanceStrategy,
  BoundingBox,
  ViewportBounds,
  calculateBalloonCollisionAvoidance,
  BALLOON_COLLISION_PRESETS,
} from '../services/balloon-collision-service.js';

export interface BalloonCollisionRoutesOptions {
  db: DatabaseInstance;
  balloonCollisionService?: BalloonCollisionService;
}

export function computeBalloonCollisionEtag(
  seriesId: string,
  avoidanceStrategy: string,
  safetyMarginPx: number,
  maxDisplacementPx: number,
  preferVerticalShift: boolean,
  isEnabled: boolean,
  updatedAt: number
): string {
  return `"bc-${seriesId}-${avoidanceStrategy}-${safetyMarginPx}-${maxDisplacementPx}-${preferVerticalShift ? 1 : 0}-${isEnabled ? 1 : 0}-${updatedAt}"`;
}

export const balloonCollisionRoutes: FastifyPluginAsync<BalloonCollisionRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: BalloonCollisionRoutesOptions
) => {
  const service = opts.balloonCollisionService ?? new BalloonCollisionService(opts.db);

  /**
   * GET /api/v1/reader/balloon-collision/profile/:seriesId
   * Retrieves active profile with ETag caching
   */
  fastify.get<{
    Params: { seriesId: string };
  }>('/api/v1/reader/balloon-collision/profile/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;

    if (!seriesId || seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid or missing seriesId parameter',
      });
    }

    const profile = service.getProfile(seriesId);
    const etag = computeBalloonCollisionEtag(
      profile.seriesId,
      profile.avoidanceStrategy,
      profile.safetyMarginPx,
      profile.maxDisplacementPx,
      profile.preferVerticalShift,
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
   * POST /api/v1/reader/balloon-collision/profile
   * Saves or updates collision avoidance profile
   */
  fastify.post<{
    Body: {
      seriesId: string;
      avoidanceStrategy?: AvoidanceStrategy;
      safetyMarginPx?: number;
      maxDisplacementPx?: number;
      preferVerticalShift?: boolean;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/balloon-collision/profile', async (request, reply) => {
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
      avoidanceStrategy: body.avoidanceStrategy,
      safetyMarginPx: body.safetyMarginPx,
      maxDisplacementPx: body.maxDisplacementPx,
      preferVerticalShift: body.preferVerticalShift,
      isEnabled: body.isEnabled,
    });

    return reply.status(200).send({ success: true, profile: updated });
  });

  /**
   * POST /api/v1/reader/balloon-collision/calculate-avoidance
   * Real-time zero-allocation 2D AABB collision avoidance calculation
   */
  fastify.post<{
    Body: {
      overlayBox: BoundingBox;
      balloonBoxes?: BoundingBox[];
      viewport?: ViewportBounds;
      strategy?: AvoidanceStrategy;
      safetyMarginPx?: number;
      maxDisplacementPx?: number;
      preferVerticalShift?: boolean;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/balloon-collision/calculate-avoidance', async (request, reply) => {
    const body = request.body;
    if (!body || !body.overlayBox) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Missing required overlayBox parameter',
      });
    }

    const result = calculateBalloonCollisionAvoidance(
      body.overlayBox,
      body.balloonBoxes ?? [],
      body.viewport ?? { width: 1280, height: 720 },
      body.strategy ?? 'minimal_euclidean',
      body.safetyMarginPx ?? 12,
      body.maxDisplacementPx ?? 120,
      body.preferVerticalShift ?? true,
      body.isEnabled ?? true
    );

    return reply.status(200).send({
      success: true,
      result,
    });
  });

  /**
   * GET /api/v1/reader/balloon-collision/presets
   * Retrieves predefined avoidance presets
   */
  fastify.get('/api/v1/reader/balloon-collision/presets', async (_request, reply) => {
    return reply.status(200).send({
      success: true,
      presets: service.getPresets(),
    });
  });
};
