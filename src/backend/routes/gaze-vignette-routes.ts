/**
 * KuraScroll - Sprint 129: Kinetic Peripheral Vignette & Micro-Saccade Gaze Stabilizer Routes
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  GazeVignetteService,
  GazeVignettePresetName,
  GAZE_VIGNETTE_PRESETS,
  calculateGazeVignette,
} from '../services/gaze-vignette-service.js';

export interface GazeVignetteRoutesOptions {
  db: DatabaseInstance;
  gazeVignetteService?: GazeVignetteService;
}

export function computeGazeVignetteEtag(
  seriesId: string,
  presetName: string,
  omega: number,
  deadZonePx: number,
  snapThresholdPx: number,
  vignetteMax: number,
  radiusX: number,
  radiusY: number,
  q0: number,
  q1: number,
  isEnabled: boolean,
  updatedAt: number
): string {
  return `"gv-${seriesId}-${presetName}-${omega}-${deadZonePx}-${snapThresholdPx}-${vignetteMax}-${radiusX}-${radiusY}-${q0}-${q1}-${isEnabled ? 1 : 0}-${updatedAt}"`;
}

export const gazeVignetteRoutes: FastifyPluginAsync<GazeVignetteRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: GazeVignetteRoutesOptions
) => {
  const service = opts.gazeVignetteService ?? new GazeVignetteService(opts.db);

  /**
   * GET /api/v1/reader/gaze-vignette/presets
   */
  fastify.get('/api/v1/reader/gaze-vignette/presets', async (_request, reply) => {
    return reply.status(200).send({
      success: true,
      presets: GAZE_VIGNETTE_PRESETS,
    });
  });

  /**
   * GET /api/v1/reader/gaze-vignette/profile/:seriesId
   */
  fastify.get<{
    Params: { seriesId: string };
  }>('/api/v1/reader/gaze-vignette/profile/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;

    if (!seriesId || seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid or missing seriesId parameter',
      });
    }

    const profile = service.getProfile(seriesId);
    const etag = computeGazeVignetteEtag(
      profile.seriesId,
      profile.presetName,
      profile.omega,
      profile.deadZonePx,
      profile.snapThresholdPx,
      profile.vignetteMax,
      profile.radiusX,
      profile.radiusY,
      profile.q0,
      profile.q1,
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
   * PUT /api/v1/reader/gaze-vignette/profile/:seriesId
   */
  fastify.put<{
    Params: { seriesId: string };
    Body: {
      presetName?: GazeVignettePresetName;
      omega?: number;
      deadZonePx?: number;
      snapThresholdPx?: number;
      vignetteMax?: number;
      radiusX?: number;
      radiusY?: number;
      q0?: number;
      q1?: number;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/gaze-vignette/profile/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;

    if (!seriesId || seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid or missing seriesId parameter',
      });
    }

    const body = request.body || {};

    if (body.presetName && !GAZE_VIGNETTE_PRESETS[body.presetName]) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: `Invalid presetName: ${body.presetName}`,
      });
    }

    if (body.omega !== undefined && (body.omega < 1.0 || body.omega > 40.0)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'omega must be between 1.0 and 40.0',
      });
    }

    if (body.deadZonePx !== undefined && (body.deadZonePx < 0.0 || body.deadZonePx > 20.0)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'deadZonePx must be between 0.0 and 20.0',
      });
    }

    if (body.snapThresholdPx !== undefined && (body.snapThresholdPx < 20.0 || body.snapThresholdPx > 500.0)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'snapThresholdPx must be between 20.0 and 500.0',
      });
    }

    if (body.vignetteMax !== undefined && (body.vignetteMax < 0.0 || body.vignetteMax > 0.80)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'vignetteMax must be between 0.0 and 0.80',
      });
    }

    const updated = service.saveProfile(seriesId, body);
    const etag = computeGazeVignetteEtag(
      updated.seriesId,
      updated.presetName,
      updated.omega,
      updated.deadZonePx,
      updated.snapThresholdPx,
      updated.vignetteMax,
      updated.radiusX,
      updated.radiusY,
      updated.q0,
      updated.q1,
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
   * POST /api/v1/reader/gaze-vignette/evaluate
   */
  fastify.post<{
    Body: {
      currX?: number;
      currY?: number;
      targetX?: number;
      targetY?: number;
      currVx?: number;
      currVy?: number;
      dt?: number;
      omega?: number;
      deadZonePx?: number;
      snapThresholdPx?: number;
      vignetteMax?: number;
      radiusX?: number;
      radiusY?: number;
      q0?: number;
      q1?: number;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/gaze-vignette/evaluate', async (request, reply) => {
    const {
      currX = 100,
      currY = 100,
      targetX = 120,
      targetY = 110,
      currVx = 0,
      currVy = 0,
      dt = 0.016,
      omega = 8.0,
      deadZonePx = 1.5,
      snapThresholdPx = 120.0,
      vignetteMax = 0.12,
      radiusX = 0.55,
      radiusY = 0.65,
      q0 = 0.70,
      q1 = 1.20,
      isEnabled = true,
    } = request.body || {};

    const result = calculateGazeVignette(
      currX,
      currY,
      targetX,
      targetY,
      currVx,
      currVy,
      dt,
      omega,
      deadZonePx,
      snapThresholdPx,
      vignetteMax,
      radiusX,
      radiusY,
      q0,
      q1,
      isEnabled
    );

    return reply.status(200).send({
      success: true,
      result,
    });
  });
};
