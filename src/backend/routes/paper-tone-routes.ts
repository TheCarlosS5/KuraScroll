/**
 * KuraScroll Paper Tone & E-Ink Palette Fastify Routes
 * Sprint 64 - Zero-Latency Circadian Tone Calibration Endpoints
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  PaperToneService,
  PaperToneProfile,
  SetPaperToneInput,
  PresetMetadata,
} from '../services/paper-tone-service.js';

export interface PaperToneRoutesOptions {
  db: DatabaseInstance;
  paperToneService?: PaperToneService;
}

export const paperToneRoutes: FastifyPluginAsync<PaperToneRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: PaperToneRoutesOptions
) => {
  const service = opts.paperToneService ?? new PaperToneService(opts.db);

  /**
   * GET /api/v1/reader/tone/profile
   * Retrieves active paper tone profile (with series override and global fallback)
   */
  fastify.get<{
    Querystring: {
      userId?: string;
      seriesId?: string;
    };
  }>('/api/v1/reader/tone/profile', async (request, reply) => {
    const { userId = 'default_user', seriesId } = request.query;

    const profile: PaperToneProfile = service.getProfile(userId, seriesId || null);

    return reply.status(200).send({
      success: true,
      profile,
    });
  });

  /**
   * POST /api/v1/reader/tone/profile
   * Sets or updates paper tone preferences for user/series
   */
  fastify.post<{
    Body: SetPaperToneInput;
  }>('/api/v1/reader/tone/profile', async (request, reply) => {
    const input = request.body ?? {};

    const profile = service.setProfile(input);

    return reply.status(200).send({
      success: true,
      profile,
    });
  });

  /**
   * DELETE /api/v1/reader/tone/profile
   * Resets paper tone preference back to default
   */
  fastify.delete<{
    Querystring: {
      userId?: string;
      seriesId?: string;
    };
  }>('/api/v1/reader/tone/profile', async (request, reply) => {
    const { userId = 'default_user', seriesId } = request.query;

    const reset = service.resetProfile(userId, seriesId || null);

    return reply.status(200).send({
      success: true,
      reset,
    });
  });

  /**
   * GET /api/v1/reader/tone/presets
   * Lists available paper tone & e-ink presets with colorimetric metadata
   */
  fastify.get('/api/v1/reader/tone/presets', async (_request, reply) => {
    const presets: PresetMetadata[] = service.getPresets();

    return reply.status(200).send({
      success: true,
      count: presets.length,
      presets,
    });
  });
};
