/**
 * KuraScroll - Sprint 116: Adaptive Dialogue Balloon Tail Tracking & Dynamic Focus Pointer Routes
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  BalloonTailService,
  TailStyle,
  BalloonShape,
  calculateBalloonTail,
  BALLOON_TAIL_PRESETS,
} from '../services/balloon-tail-service.js';

export interface BalloonTailRoutesOptions {
  db: DatabaseInstance;
  balloonTailService?: BalloonTailService;
}

export function computeBalloonTailEtag(
  seriesId: string,
  tailStyle: string,
  balloonShape: string,
  rootWidthPx: number,
  curvatureFactor: number,
  tipOffsetPx: number,
  isEnabled: boolean,
  updatedAt: number
): string {
  return `"bt-${seriesId}-${tailStyle}-${balloonShape}-${rootWidthPx}-${curvatureFactor}-${tipOffsetPx}-${isEnabled ? 1 : 0}-${updatedAt}"`;
}

export const balloonTailRoutes: FastifyPluginAsync<BalloonTailRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: BalloonTailRoutesOptions
) => {
  const service = opts.balloonTailService ?? new BalloonTailService(opts.db);

  /**
   * GET /api/v1/reader/balloon-tail/presets
   * Retrieves all available balloon tail presets
   */
  fastify.get('/api/v1/reader/balloon-tail/presets', async (_request, reply) => {
    return reply.status(200).send({
      success: true,
      presets: BALLOON_TAIL_PRESETS,
    });
  });

  /**
   * GET /api/v1/reader/balloon-tail/profile/:seriesId
   * Retrieves active profile with ETag caching
   */
  fastify.get<{
    Params: { seriesId: string };
  }>('/api/v1/reader/balloon-tail/profile/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;

    if (!seriesId || seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid or missing seriesId parameter',
      });
    }

    const profile = service.getProfile(seriesId);
    const etag = computeBalloonTailEtag(
      profile.seriesId,
      profile.tailStyle,
      profile.balloonShape,
      profile.rootWidthPx,
      profile.curvatureFactor,
      profile.tipOffsetPx,
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
   * POST /api/v1/reader/balloon-tail/profile
   * Saves or updates balloon tail profile
   */
  fastify.post<{
    Body: {
      seriesId: string;
      tailStyle?: TailStyle;
      balloonShape?: BalloonShape;
      rootWidthPx?: number;
      curvatureFactor?: number;
      tipOffsetPx?: number;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/balloon-tail/profile', async (request, reply) => {
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
      tailStyle: body.tailStyle,
      balloonShape: body.balloonShape,
      rootWidthPx: body.rootWidthPx,
      curvatureFactor: body.curvatureFactor,
      tipOffsetPx: body.tipOffsetPx,
      isEnabled: body.isEnabled,
    });

    return reply.status(200).send({ success: true, profile: updated });
  });

  /**
   * POST /api/v1/reader/balloon-tail/calculate
   * Real-time zero-allocation balloon tail vector math & SVG path generation
   */
  fastify.post<{
    Body: {
      balloonCenterX: number;
      balloonCenterY: number;
      radiusX: number;
      radiusY: number;
      targetAnchorX: number;
      targetAnchorY: number;
      tailStyle?: TailStyle;
      balloonShape?: BalloonShape;
      rootWidthPx?: number;
      curvatureFactor?: number;
      tipOffsetPx?: number;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/balloon-tail/calculate', async (request, reply) => {
    const {
      balloonCenterX,
      balloonCenterY,
      radiusX,
      radiusY,
      targetAnchorX,
      targetAnchorY,
      tailStyle,
      balloonShape,
      rootWidthPx,
      curvatureFactor,
      tipOffsetPx,
      isEnabled,
    } = request.body ?? {};

    if (
      balloonCenterX === undefined ||
      balloonCenterY === undefined ||
      radiusX === undefined ||
      radiusY === undefined ||
      targetAnchorX === undefined ||
      targetAnchorY === undefined
    ) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Missing required balloon geometry coordinates',
      });
    }

    const result = calculateBalloonTail(
      balloonCenterX,
      balloonCenterY,
      radiusX,
      radiusY,
      targetAnchorX,
      targetAnchorY,
      tailStyle,
      balloonShape,
      rootWidthPx,
      curvatureFactor,
      tipOffsetPx,
      isEnabled
    );

    return reply.status(200).send({
      success: true,
      result,
    });
  });
};
