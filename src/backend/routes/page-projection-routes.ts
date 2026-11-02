/**
 * KuraScroll Continuous Page Glance & Multi-Angle Reading Projection Fastify Routes
 * Sprint 81 - Perspective Keystone & Tilt-Shift Depth-of-Field Engine
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  PageProjectionService,
  PageProjectionProfile,
  FocalPlanePreset,
  calculateProjectionTransform,
  computeProjectionEtag,
  CANONICAL_PROJECTION_PRESETS,
} from '../services/page-projection-service.js';

export interface PageProjectionRoutesOptions {
  db: DatabaseInstance;
  pageProjectionService?: PageProjectionService;
}

export const pageProjectionRoutes: FastifyPluginAsync<PageProjectionRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: PageProjectionRoutesOptions
) => {
  const service = opts.pageProjectionService ?? new PageProjectionService(opts.db);

  /**
   * GET /api/v1/projection/profile/:seriesId
   * Retrieves active projection profile for a series with ETag caching
   */
  fastify.get<{
    Params: { seriesId: string };
    Querystring: { userId?: string };
  }>('/api/v1/projection/profile/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;
    const { userId } = request.query;

    if (!seriesId || seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid seriesId parameter',
      });
    }

    const profile = service.getProfile(seriesId, userId);
    const etag = computeProjectionEtag(
      profile.pitchDegrees,
      profile.yawDegrees,
      profile.perspectivePx,
      profile.keystoneCorrection,
      profile.focalPlanePreset
    );

    if (request.headers['if-none-match'] === etag) {
      return reply.status(304).send();
    }

    reply.header('Cache-Control', 'private, max-age=60, must-revalidate');
    reply.header('ETag', etag);
    return reply.status(200).send({ success: true, profile });
  });

  /**
   * POST /api/v1/projection/profile
   * Saves or updates a page projection profile
   */
  fastify.post<{
    Body: {
      seriesId: string;
      userId?: string;
      pitchDegrees?: number;
      yawDegrees?: number;
      perspectivePx?: number;
      keystoneCorrection?: number;
      focalPlanePreset?: FocalPlanePreset;
      isEnabled?: boolean;
    };
  }>('/api/v1/projection/profile', async (request, reply) => {
    const body = request.body;
    if (!body || !body.seriesId) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'seriesId is required',
      });
    }

    const saved = service.saveProfile(body);
    return reply.status(200).send({
      success: true,
      profile: saved,
    });
  });

  /**
   * POST /api/v1/projection/calculate-transform
   * Real-time zero-allocation perspective projection transform resolution
   */
  fastify.post<{
    Body: {
      pitchDegrees?: number;
      yawDegrees?: number;
      perspectivePx?: number;
      keystoneCorrection?: number;
    };
  }>('/api/v1/projection/calculate-transform', async (request, reply) => {
    const {
      pitchDegrees = 0.0,
      yawDegrees = 0.0,
      perspectivePx = 1000,
      keystoneCorrection = 0.0,
    } = request.body || {};

    const result = calculateProjectionTransform(
      pitchDegrees,
      yawDegrees,
      perspectivePx,
      keystoneCorrection
    );

    return reply.status(200).send({
      success: true,
      transform: result,
    });
  });

  /**
   * GET /api/v1/projection/presets
   * Returns list of canonical focal plane presets
   */
  fastify.get('/api/v1/projection/presets', async (_request, reply) => {
    return reply.status(200).send({
      success: true,
      presets: CANONICAL_PROJECTION_PRESETS,
    });
  });
};
