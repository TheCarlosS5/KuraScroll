/**
 * KuraScroll Dynamic Optical Reading Ruler & Saccadic Guided Focus Fastify Routes
 * Sprint 71 - Optical Focus & Accessibility Assistance Endpoints
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  ReadingRulerService,
  ReadingRulerPreferences,
  CalculateApertureOptions,
} from '../services/reading-ruler-service.js';
import crypto from 'node:crypto';

export interface ReadingRulerRoutesOptions {
  db: DatabaseInstance;
  readingRulerService?: ReadingRulerService;
}

export const readingRulerRoutes: FastifyPluginAsync<ReadingRulerRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: ReadingRulerRoutesOptions
) => {
  const service = opts.readingRulerService ?? new ReadingRulerService(opts.db);

  /**
   * GET /api/v1/ruler/preferences/:userId
   * Retrieves reading ruler preferences for a user
   */
  fastify.get<{
    Params: { userId: string };
  }>('/api/v1/ruler/preferences/:userId', async (request, reply) => {
    const { userId } = request.params;

    if (!userId || userId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid userId parameter',
      });
    }

    const prefs = service.getPreferences(userId);
    const payload = JSON.stringify({ success: true, preferences: prefs });
    const etag = `"${crypto.createHash('md5').update(payload).digest('hex')}"`;

    if (request.headers['if-none-match'] === etag) {
      return reply.status(304).send();
    }

    reply.header('Cache-Control', 'private, max-age=60, must-revalidate');
    reply.header('ETag', etag);
    return reply.status(200).type('application/json').send(payload);
  });

  /**
   * POST /api/v1/ruler/preferences
   * Persists reading ruler preferences for a user
   */
  fastify.post<{
    Body: ReadingRulerPreferences;
  }>('/api/v1/ruler/preferences', async (request, reply) => {
    const body = request.body;

    if (!body || typeof body.userId !== 'string') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid request body. Required: userId',
      });
    }

    try {
      const saved = service.savePreferences(body);
      return reply.status(200).send({
        success: true,
        preferences: saved,
      });
    } catch (err: any) {
      request.log.error(err);
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: err.message || 'Failed to save reading ruler preferences',
      });
    }
  });

  /**
   * POST /api/v1/ruler/calculate-aperture
   * Computes zero-allocation aperture geometry & CSS custom variables
   */
  fastify.post<{
    Body: CalculateApertureOptions;
  }>('/api/v1/ruler/calculate-aperture', async (request, reply) => {
    const options = request.body;

    if (!options || typeof options.centerCoord !== 'number' || typeof options.viewportLimit !== 'number') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid request body. Required: centerCoord and viewportLimit numbers',
      });
    }

    const geometry = service.calculateAperture(options);
    return reply.status(200).send({
      success: true,
      geometry,
    });
  });

  /**
   * DELETE /api/v1/ruler/preferences/:userId
   * Resets reading ruler preferences to defaults
   */
  fastify.delete<{
    Params: { userId: string };
  }>('/api/v1/ruler/preferences/:userId', async (request, reply) => {
    const { userId } = request.params;

    if (!userId || userId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid userId parameter',
      });
    }

    const reset = service.resetPreferences(userId);
    return reply.status(200).send({
      success: true,
      message: `Preferences reset for user ${userId}`,
      preferences: reset,
    });
  });
};
