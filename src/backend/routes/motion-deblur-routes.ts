/**
 * KuraScroll - Sprint 132: Kinetic Scrolling Motion Deblur & Retinal Persistence Overdrive Compensator Routes
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  MotionDeblurService,
  MotionDeblurPresetName,
  MOTION_DEBLUR_PRESETS,
  calculateMotionDeblur,
} from '../services/motion-deblur-service.js';

export interface MotionDeblurRoutesOptions {
  db: DatabaseInstance;
  motionDeblurService?: MotionDeblurService;
}

export function computeMotionDeblurEtag(
  seriesId: string,
  presetName: string,
  kod: number,
  vHalf: number,
  maxDelta: number,
  gammaFall: number,
  gammaRise: number,
  isEnabled: boolean,
  updatedAt: number
): string {
  return `"md-${seriesId}-${presetName}-${kod}-${vHalf}-${maxDelta}-${gammaFall}-${gammaRise}-${isEnabled ? 1 : 0}-${updatedAt}"`;
}

export const motionDeblurRoutes: FastifyPluginAsync<MotionDeblurRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: MotionDeblurRoutesOptions
) => {
  const service = opts.motionDeblurService ?? new MotionDeblurService(opts.db);

  /**
   * GET /api/v1/reader/motion-deblur/presets
   */
  fastify.get('/api/v1/reader/motion-deblur/presets', async (_request, reply) => {
    return reply.status(200).send({
      success: true,
      presets: MOTION_DEBLUR_PRESETS,
    });
  });

  /**
   * GET /api/v1/reader/motion-deblur/profile/:seriesId
   */
  fastify.get<{
    Params: { seriesId: string };
  }>('/api/v1/reader/motion-deblur/profile/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;

    if (!seriesId || seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid or missing seriesId parameter',
      });
    }

    const profile = service.getProfile(seriesId);
    const etag = computeMotionDeblurEtag(
      profile.seriesId,
      profile.presetName,
      profile.kod,
      profile.vHalf,
      profile.maxDelta,
      profile.gammaFall,
      profile.gammaRise,
      profile.isEnabled,
      profile.updatedAt
    );

    if (request.headers['if-none-match'] === etag) {
      return reply.status(304).send();
    }

    reply.header('ETag', etag);
    reply.header('Cache-Control', 'private, no-cache');
    return reply.status(200).send({
      success: true,
      profile,
    });
  });

  /**
   * PUT /api/v1/reader/motion-deblur/profile/:seriesId
   */
  fastify.put<{
    Params: { seriesId: string };
    Body: {
      presetName?: MotionDeblurPresetName;
      kod?: number;
      vHalf?: number;
      maxDelta?: number;
      gammaFall?: number;
      gammaRise?: number;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/motion-deblur/profile/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;

    if (!seriesId || seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid or missing seriesId parameter',
      });
    }

    const body = request.body || {};

    if (body.presetName && !MOTION_DEBLUR_PRESETS[body.presetName]) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: `Invalid presetName: ${body.presetName}`,
      });
    }

    if (body.kod !== undefined && (body.kod < 0.0 || body.kod > 3.0)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'kod must be between 0.0 and 3.0',
      });
    }

    if (body.vHalf !== undefined && (body.vHalf < 50.0 || body.vHalf > 3000.0)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'vHalf must be between 50.0 and 3000.0',
      });
    }

    if (body.maxDelta !== undefined && (body.maxDelta < 5.0 || body.maxDelta > 120.0)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'maxDelta must be between 5.0 and 120.0',
      });
    }

    if (body.gammaFall !== undefined && (body.gammaFall < 0.5 || body.gammaFall > 2.5)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'gammaFall must be between 0.5 and 2.5',
      });
    }

    if (body.gammaRise !== undefined && (body.gammaRise < 0.5 || body.gammaRise > 2.5)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'gammaRise must be between 0.5 and 2.5',
      });
    }

    const updated = service.saveProfile(seriesId, body);
    const etag = computeMotionDeblurEtag(
      updated.seriesId,
      updated.presetName,
      updated.kod,
      updated.vHalf,
      updated.maxDelta,
      updated.gammaFall,
      updated.gammaRise,
      updated.isEnabled,
      updated.updatedAt
    );

    reply.header('ETag', etag);
    return reply.status(200).send({
      success: true,
      profile: updated,
    });
  });

  /**
   * POST /api/v1/reader/motion-deblur/simulate
   */
  fastify.post<{
    Body: {
      inL: number;
      prevL: number;
      velocityPxS?: number;
      kod?: number;
      vHalf?: number;
      maxDelta?: number;
      gammaFall?: number;
      gammaRise?: number;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/motion-deblur/simulate', async (request, reply) => {
    const {
      inL,
      prevL,
      velocityPxS = 800.0,
      kod = 1.35,
      vHalf = 650.0,
      maxDelta = 45.0,
      gammaFall = 1.30,
      gammaRise = 1.00,
      isEnabled = true,
    } = request.body || {};

    if (inL === undefined || prevL === undefined) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'inL and prevL are required',
      });
    }

    const result = calculateMotionDeblur(
      inL,
      prevL,
      velocityPxS,
      kod,
      vHalf,
      maxDelta,
      gammaFall,
      gammaRise,
      isEnabled
    );

    return reply.status(200).send({
      success: true,
      result: {
        inL: result.inL,
        prevL: result.prevL,
        velocityPxS: result.velocityPxS,
        boost: result.boost,
        outL: result.outL,
        isOverdriven: result.isOverdriven,
        latencyUs: result.latencyUs,
      },
    });
  });
};
