/**
 * KuraScroll Saccadic Motion Trajectory Smoothing & Dynamic Inertial Scroller Fastify Routes
 * Sprint 88 - InertialScroll Engine
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  InertialScrollService,
  InertialScrollProfile,
  INERTIAL_SCROLL_PRESETS,
} from '../services/inertial-scroll-service.js';

export interface InertialScrollRoutesOptions {
  db: DatabaseInstance;
  inertialScrollService?: InertialScrollService;
}

export function computeInertialScrollEtag(
  seriesId: string,
  frictionCoefficient: number,
  mass: number,
  springTension: number,
  velocityClampPx: number,
  isEnabled: boolean,
  updatedAt: number
): string {
  return `"is-${seriesId}-${frictionCoefficient}-${mass}-${springTension}-${velocityClampPx}-${isEnabled ? 1 : 0}-${updatedAt}"`;
}

export const inertialScrollRoutes: FastifyPluginAsync<InertialScrollRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: InertialScrollRoutesOptions
) => {
  const service = opts.inertialScrollService ?? new InertialScrollService(opts.db);

  /**
   * GET /api/v1/reader/inertial-scroll/profile/:seriesId
   * Retrieves active profile with ETag caching
   */
  fastify.get<{
    Params: { seriesId: string };
  }>('/api/v1/reader/inertial-scroll/profile/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;

    if (!seriesId || seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid seriesId parameter',
      });
    }

    const profile = service.getProfile(seriesId);
    const etag = computeInertialScrollEtag(
      profile.seriesId,
      profile.frictionCoefficient,
      profile.mass,
      profile.springTension,
      profile.velocityClampPx,
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
   * POST /api/v1/reader/inertial-scroll/profile
   * Saves or updates an inertial scroll profile
   */
  fastify.post<{
    Body: {
      seriesId: string;
      frictionCoefficient?: number;
      mass?: number;
      springTension?: number;
      velocityClampPx?: number;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/inertial-scroll/profile', async (request, reply) => {
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
      frictionCoefficient: body.frictionCoefficient ?? current.frictionCoefficient,
      mass: body.mass ?? current.mass,
      springTension: body.springTension ?? current.springTension,
      velocityClampPx: body.velocityClampPx ?? current.velocityClampPx,
      isEnabled: body.isEnabled !== undefined ? body.isEnabled : current.isEnabled,
      updatedAt: Date.now(),
    });

    return reply.status(200).send({ success: true, profile: updated });
  });

  /**
   * POST /api/v1/reader/inertial-scroll/calculate-step
   * Calculates kinematic physics step in sub-20 microseconds
   */
  fastify.post<{
    Body: {
      currentPos: number;
      targetPos: number;
      velocity: number;
      friction?: number;
      springTension?: number;
      mass?: number;
      deltaTimeMs?: number;
      velocityClampPx?: number;
    };
  }>('/api/v1/reader/inertial-scroll/calculate-step', async (request, reply) => {
    const {
      currentPos,
      targetPos,
      velocity,
      friction,
      springTension,
      mass,
      deltaTimeMs,
      velocityClampPx,
    } = request.body || {};

    if (currentPos === undefined || targetPos === undefined || velocity === undefined) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Missing currentPos, targetPos, or velocity',
      });
    }

    const result = service.calculateInertialStep(
      currentPos,
      targetPos,
      velocity,
      friction ?? 0.92,
      springTension ?? 120.0,
      mass ?? 1.0,
      deltaTimeMs ?? 16.6667,
      velocityClampPx ?? 3500.0
    );

    return reply.status(200).send({ success: true, result });
  });

  /**
   * GET /api/v1/reader/inertial-scroll/presets
   * Lists predefined kinematic scroll presets
   */
  fastify.get('/api/v1/reader/inertial-scroll/presets', async (_request, reply) => {
    return reply.status(200).send({
      success: true,
      presets: INERTIAL_SCROLL_PRESETS,
    });
  });
};
