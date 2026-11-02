/**
 * KuraScroll - Sprint 95: Adaptive Peripheral In-Viewport Motion-Deblur & Micro-Pan Stabilizer Fastify Routes
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  MotionStabilizerService,
  MotionStabilizerProfile,
  StabilizerMode,
  MOTION_STABILIZER_PRESETS,
} from '../services/motion-stabilizer-service.js';

export interface MotionStabilizerRoutesOptions {
  db: DatabaseInstance;
  motionStabilizerService?: MotionStabilizerService;
}

export function computeMotionStabilizerEtag(
  seriesId: string,
  stabilizerMode: string,
  dampingCoefficient: number,
  velocityThresholdPx: number,
  contrastBoostFactor: number,
  isAntiGhostingEnabled: boolean,
  isEnabled: boolean,
  updatedAt: number
): string {
  return `"ms-${seriesId}-${stabilizerMode}-${dampingCoefficient}-${velocityThresholdPx}-${contrastBoostFactor}-${isAntiGhostingEnabled ? 1 : 0}-${isEnabled ? 1 : 0}-${updatedAt}"`;
}

export const motionStabilizerRoutes: FastifyPluginAsync<MotionStabilizerRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: MotionStabilizerRoutesOptions
) => {
  const service = opts.motionStabilizerService ?? new MotionStabilizerService(opts.db);

  /**
   * GET /api/v1/reader/motion-stabilizer/profile/:seriesId
   * Retrieves active profile with ETag caching
   */
  fastify.get<{
    Params: { seriesId: string };
  }>('/api/v1/reader/motion-stabilizer/profile/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;

    if (!seriesId || seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid seriesId parameter',
      });
    }

    const profile = service.getProfile(seriesId);
    const etag = computeMotionStabilizerEtag(
      profile.seriesId,
      profile.stabilizerMode,
      profile.dampingCoefficient,
      profile.velocityThresholdPx,
      profile.contrastBoostFactor,
      profile.isAntiGhostingEnabled,
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
   * POST /api/v1/reader/motion-stabilizer/profile
   * Saves or updates a motion stabilizer profile
   */
  fastify.post<{
    Body: {
      seriesId: string;
      stabilizerMode?: StabilizerMode;
      dampingCoefficient?: number;
      velocityThresholdPx?: number;
      contrastBoostFactor?: number;
      isAntiGhostingEnabled?: boolean;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/motion-stabilizer/profile', async (request, reply) => {
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
      stabilizerMode: body.stabilizerMode ?? current.stabilizerMode,
      dampingCoefficient: body.dampingCoefficient ?? current.dampingCoefficient,
      velocityThresholdPx: body.velocityThresholdPx ?? current.velocityThresholdPx,
      contrastBoostFactor: body.contrastBoostFactor ?? current.contrastBoostFactor,
      isAntiGhostingEnabled: body.isAntiGhostingEnabled !== undefined ? body.isAntiGhostingEnabled : current.isAntiGhostingEnabled,
      isEnabled: body.isEnabled !== undefined ? body.isEnabled : current.isEnabled,
      updatedAt: Date.now(),
    });

    return reply.status(200).send({ success: true, profile: updated });
  });

  /**
   * POST /api/v1/reader/motion-stabilizer/calculate-stabilizer-params
   * Evaluates gesture damping and anti-ghosting contrast in sub-20 microseconds
   */
  fastify.post<{
    Body: {
      rawVelocityPx?: number;
      prevVelocityPx?: number;
      deltaY?: number;
      damping?: number;
      thresholdPx?: number;
      contrastBoost?: number;
      isAntiGhosting?: boolean;
      mode?: StabilizerMode;
    };
  }>('/api/v1/reader/motion-stabilizer/calculate-stabilizer-params', async (request, reply) => {
    const {
      rawVelocityPx,
      prevVelocityPx,
      deltaY,
      damping,
      thresholdPx,
      contrastBoost,
      isAntiGhosting,
      mode,
    } = request.body || {};

    const result = service.calculateStabilizerKinematics(
      rawVelocityPx ?? 0,
      prevVelocityPx ?? 0,
      deltaY ?? 0,
      damping ?? 0.75,
      thresholdPx ?? 350.0,
      contrastBoost ?? 1.25,
      isAntiGhosting ?? true,
      mode ?? 'smooth_spring'
    );

    return reply.status(200).send({ success: true, result });
  });

  /**
   * GET /api/v1/reader/motion-stabilizer/presets
   * Lists predefined motion stabilizer configurations
   */
  fastify.get('/api/v1/reader/motion-stabilizer/presets', async (_request, reply) => {
    return reply.status(200).send({
      success: true,
      presets: MOTION_STABILIZER_PRESETS,
    });
  });
};
