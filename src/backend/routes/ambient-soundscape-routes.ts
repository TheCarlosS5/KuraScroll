/**
 * KuraScroll Multi-Track Ambient Soundscapes & Atmospheric BGM Mixer Fastify Routes
 * Sprint 73 - Atmospheric Soundscapes, Multi-Track Mixing & Equal-Power Cross-Fade
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  AmbientSoundscapeService,
  UserSoundscapePreferences,
} from '../services/ambient-soundscape-service.js';
import crypto from 'node:crypto';

export interface AmbientSoundscapeRoutesOptions {
  db: DatabaseInstance;
  soundscapeService?: AmbientSoundscapeService;
}

export const ambientSoundscapeRoutes: FastifyPluginAsync<AmbientSoundscapeRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: AmbientSoundscapeRoutesOptions
) => {
  const service = opts.soundscapeService ?? new AmbientSoundscapeService(opts.db);

  /**
   * GET /api/v1/soundscape/presets
   * Retrieves all atmospheric soundscape presets, optionally filtered by genre
   */
  fastify.get<{
    Querystring: { genre?: string };
  }>('/api/v1/soundscape/presets', async (request, reply) => {
    const { genre } = request.query;
    const presets = service.getPresets(genre);
    const payload = JSON.stringify({ success: true, count: presets.length, presets });
    const etag = `"${crypto.createHash('md5').update(payload).digest('hex')}"`;

    if (request.headers['if-none-match'] === etag) {
      return reply.status(304).send();
    }

    reply.header('Cache-Control', 'public, max-age=3600, must-revalidate');
    reply.header('ETag', etag);
    return reply.status(200).type('application/json').send(payload);
  });

  /**
   * GET /api/v1/soundscape/preset/:id
   * Retrieves a specific preset by ID
   */
  fastify.get<{
    Params: { id: string };
  }>('/api/v1/soundscape/preset/:id', async (request, reply) => {
    const { id } = request.params;
    const preset = service.getPresetById(id);

    if (!preset) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: `Soundscape preset '${id}' not found`,
      });
    }

    return reply.status(200).send({
      success: true,
      preset,
    });
  });

  /**
   * GET /api/v1/soundscape/preferences/:userId
   * Retrieves user soundscape preferences with ETag caching
   */
  fastify.get<{
    Params: { userId: string };
  }>('/api/v1/soundscape/preferences/:userId', async (request, reply) => {
    const { userId } = request.params;

    if (!userId || userId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid userId parameter',
      });
    }

    const preferences = service.getUserPreferences(userId);
    const payload = JSON.stringify({ success: true, preferences });
    const etag = `"${crypto.createHash('md5').update(payload).digest('hex')}"`;

    if (request.headers['if-none-match'] === etag) {
      return reply.status(304).send();
    }

    reply.header('Cache-Control', 'private, max-age=60, must-revalidate');
    reply.header('ETag', etag);
    return reply.status(200).type('application/json').send(payload);
  });

  /**
   * PUT /api/v1/soundscape/preferences
   * Updates or saves user soundscape preferences
   */
  fastify.put<{
    Body: UserSoundscapePreferences;
  }>('/api/v1/soundscape/preferences', async (request, reply) => {
    const body = request.body;

    if (!body || !body.userId || typeof body.masterVolume !== 'number') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid request body. Required: userId, masterVolume',
      });
    }

    const updated = service.updateUserPreferences(body);
    return reply.status(200).send({
      success: true,
      preferences: updated,
    });
  });

  /**
   * POST /api/v1/soundscape/calculate-gain
   * Zero-allocation equal-power cross-fade math calculation endpoint (SLA 37)
   */
  fastify.post<{
    Body: { t: number };
  }>('/api/v1/soundscape/calculate-gain', async (request, reply) => {
    const { t } = request.body || {};

    if (typeof t !== 'number') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid request body. Required: t (number in [0, 1])',
      });
    }

    const result = AmbientSoundscapeService.calculateEqualPowerCrossFade(t);
    return reply.status(200).send({
      success: true,
      ...result,
    });
  });
};
