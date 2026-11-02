/**
 * KuraScroll Predictive Gaze Heatmap Trajectory & Eye Fixation Anti-Drift Fastify Routes
 * Sprint 83 - GazeAnchor Engine
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  GazeAnchorService,
  GazeAnchorProfile,
  GazeMode,
  HeatmapResolution,
  calculateGazeTrajectory,
  computeGazeAnchorEtag,
  SUPPORTED_GAZE_MODES,
} from '../services/gaze-anchor-service.js';

export interface GazeAnchorRoutesOptions {
  db: DatabaseInstance;
  gazeAnchorService?: GazeAnchorService;
}

export const gazeAnchorRoutes: FastifyPluginAsync<GazeAnchorRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: GazeAnchorRoutesOptions
) => {
  const service = opts.gazeAnchorService ?? new GazeAnchorService(opts.db);

  /**
   * GET /api/v1/reader/gaze-anchor/profile/:seriesId
   * Retrieves gaze anchor profile with ETag caching
   */
  fastify.get<{
    Params: { seriesId: string };
  }>('/api/v1/reader/gaze-anchor/profile/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;

    if (!seriesId || seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid seriesId parameter',
      });
    }

    const profile = service.getProfile(seriesId);
    const etag = computeGazeAnchorEtag(
      profile.mode,
      profile.saccadeSensitivity,
      profile.dwellThresholdMs,
      profile.driftTolerancePx,
      profile.returnAnchorEnabled
    );

    if (request.headers['if-none-match'] === etag) {
      return reply.status(304).send();
    }

    reply.header('Cache-Control', 'private, max-age=60, must-revalidate');
    reply.header('ETag', etag);
    return reply.status(200).send({ success: true, profile });
  });

  /**
   * POST /api/v1/reader/gaze-anchor/profile
   * Saves or updates a gaze anchor profile
   */
  fastify.post<{
    Body: {
      seriesId: string;
      mode?: GazeMode;
      saccadeSensitivity?: number;
      dwellThresholdMs?: number;
      driftTolerancePx?: number;
      returnAnchorEnabled?: boolean;
      heatmapResolution?: HeatmapResolution;
    };
  }>('/api/v1/reader/gaze-anchor/profile', async (request, reply) => {
    const body = request.body;
    if (!body || !body.seriesId || body.seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'seriesId is required',
      });
    }

    const saved = service.saveProfile({
      seriesId: body.seriesId.trim(),
      mode: body.mode ?? 'manga_rtl',
      saccadeSensitivity: body.saccadeSensitivity ?? 1.0,
      dwellThresholdMs: body.dwellThresholdMs ?? 250,
      driftTolerancePx: body.driftTolerancePx ?? 40.0,
      returnAnchorEnabled: body.returnAnchorEnabled ?? true,
      heatmapResolution: body.heatmapResolution ?? 'medium',
      updatedAt: Date.now(),
    });

    return reply.status(200).send({ success: true, profile: saved });
  });

  /**
   * POST /api/v1/reader/gaze-anchor/calculate-trajectory
   * Zero-allocation sub-20µs trajectory and fixation recovery calculation (SLA 47)
   */
  fastify.post<{
    Body: {
      currentX: number;
      currentY: number;
      previousX: number;
      previousY: number;
      velocity?: number;
      mode?: GazeMode;
      dwellMs?: number;
      driftTolerancePx?: number;
      sensitivity?: number;
    };
  }>('/api/v1/reader/gaze-anchor/calculate-trajectory', async (request, reply) => {
    const body = request.body;
    if (!body) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Request body is required',
      });
    }

    const trajectory = calculateGazeTrajectory(
      body.currentX,
      body.currentY,
      body.previousX,
      body.previousY,
      body.velocity,
      body.mode,
      body.dwellMs,
      body.driftTolerancePx,
      body.sensitivity
    );

    return reply.status(200).send({ success: true, trajectory });
  });

  /**
   * GET /api/v1/reader/gaze-anchor/modes
   * Returns supported gaze reading modes
   */
  fastify.get('/api/v1/reader/gaze-anchor/modes', async (_request, reply) => {
    return reply.status(200).send({
      success: true,
      modes: SUPPORTED_GAZE_MODES,
    });
  });
};
