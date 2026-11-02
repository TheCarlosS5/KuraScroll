/**
 * KuraScroll Adaptive Ambient Lighting Reactive Backlight Fastify Routes
 * Sprint 80 - Dynamic Luminance Normalizer & Circadian Eye Shield
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  AmbientBacklightService,
  AmbientBacklightProfile,
  PaperTintMode,
  calculateBacklightTransform,
  calculateCircadianTemperature,
  computeBacklightEtag,
} from '../services/ambient-backlight-service.js';
import crypto from 'node:crypto';

export interface AmbientBacklightRoutesOptions {
  db: DatabaseInstance;
  ambientBacklightService?: AmbientBacklightService;
}

export const ambientBacklightRoutes: FastifyPluginAsync<AmbientBacklightRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: AmbientBacklightRoutesOptions
) => {
  const service = opts.ambientBacklightService ?? new AmbientBacklightService(opts.db);

  /**
   * GET /api/v1/backlight/profile/:seriesId
   * Retrieves active backlight profile for a series with ETag caching
   */
  fastify.get<{
    Params: { seriesId: string };
    Querystring: { userId?: string };
  }>('/api/v1/backlight/profile/:seriesId', async (request, reply) => {
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
    const etag = computeBacklightEtag(
      profile.kelvinTemperature,
      profile.luminanceTarget,
      profile.blueLightReductionRatio,
      profile.paperTintMode
    );

    if (request.headers['if-none-match'] === etag) {
      return reply.status(304).send();
    }

    reply.header('Cache-Control', 'private, max-age=60, must-revalidate');
    reply.header('ETag', etag);
    return reply.status(200).send({ success: true, profile });
  });

  /**
   * POST /api/v1/backlight/profile
   * Saves or updates an ambient backlight profile
   */
  fastify.post<{
    Body: {
      seriesId: string;
      userId?: string;
      kelvinTemperature?: number;
      luminanceTarget?: number;
      circadianAuto?: boolean;
      blueLightReductionRatio?: number;
      paperTintMode?: PaperTintMode;
      isEnabled?: boolean;
    };
  }>('/api/v1/backlight/profile', async (request, reply) => {
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
   * POST /api/v1/backlight/calculate-transform
   * Real-time zero-allocation color temperature transform resolution
   */
  fastify.post<{
    Body: {
      kelvin?: number;
      luminance?: number;
      blueLightReduction?: number;
    };
  }>('/api/v1/backlight/calculate-transform', async (request, reply) => {
    const { kelvin = 6500, luminance = 1.0, blueLightReduction = 0.0 } = request.body || {};
    const result = calculateBacklightTransform(kelvin, luminance, blueLightReduction);
    return reply.status(200).send({
      success: true,
      transform: result,
    });
  });

  /**
   * GET /api/v1/backlight/circadian
   * Evaluates current server circadian recommendation based on time
   */
  fastify.get<{
    Querystring: { hour?: number; minute?: number };
  }>('/api/v1/backlight/circadian', async (request, reply) => {
    const now = new Date();
    const hour = request.query.hour !== undefined ? Number(request.query.hour) : now.getHours();
    const minute = request.query.minute !== undefined ? Number(request.query.minute) : now.getMinutes();

    const kelvin = calculateCircadianTemperature(hour, minute);
    const transform = calculateBacklightTransform(kelvin, 0.95, kelvin < 3000 ? 0.5 : 0.1);

    return reply.status(200).send({
      success: true,
      hour,
      minute,
      recommendedKelvin: kelvin,
      transform,
    });
  });
};
