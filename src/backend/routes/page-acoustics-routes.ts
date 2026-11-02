/**
 * KuraScroll Binaural Page Rustle & Tactile Leaf Turn Acoustics Fastify Routes
 * Sprint 82 - Low-Frequency Sub-Bass Page Flip Haptic Synthesizer
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  PageAcousticsService,
  PageAcousticsProfile,
  PaperSubstrate,
  calculateAudioPannerParams,
  computeAcousticsEtag,
  CANONICAL_SUBSTRATE_CONFIGS,
} from '../services/page-acoustics-service.js';

export interface PageAcousticsRoutesOptions {
  db: DatabaseInstance;
  pageAcousticsService?: PageAcousticsService;
}

export const pageAcousticsRoutes: FastifyPluginAsync<PageAcousticsRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: PageAcousticsRoutesOptions
) => {
  const service = opts.pageAcousticsService ?? new PageAcousticsService(opts.db);

  /**
   * GET /api/v1/acoustics/profile/:seriesId
   * Retrieves active acoustics profile for a series with ETag caching
   */
  fastify.get<{
    Params: { seriesId: string };
    Querystring: { userId?: string };
  }>('/api/v1/acoustics/profile/:seriesId', async (request, reply) => {
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
    const etag = computeAcousticsEtag(
      profile.paperSubstrate,
      profile.volumeLevel,
      profile.stereoPanningEnabled,
      profile.hapticPulseEnabled
    );

    if (request.headers['if-none-match'] === etag) {
      return reply.status(304).send();
    }

    reply.header('Cache-Control', 'private, max-age=60, must-revalidate');
    reply.header('ETag', etag);
    return reply.status(200).send({ success: true, profile });
  });

  /**
   * POST /api/v1/acoustics/profile
   * Saves or updates a page acoustics profile
   */
  fastify.post<{
    Body: {
      seriesId: string;
      userId?: string;
      paperSubstrate?: PaperSubstrate;
      volumeLevel?: number;
      stereoPanningEnabled?: boolean;
      hapticPulseEnabled?: boolean;
      hapticIntensity?: number;
      isEnabled?: boolean;
    };
  }>('/api/v1/acoustics/profile', async (request, reply) => {
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
   * POST /api/v1/acoustics/calculate-params
   * Real-time zero-allocation binaural panning and filter resolution
   */
  fastify.post<{
    Body: {
      pageDirection?: 'next' | 'prev';
      readingDirection?: 'rtl' | 'ltr';
      substrate?: PaperSubstrate;
      volume?: number;
      stereoEnabled?: boolean;
    };
  }>('/api/v1/acoustics/calculate-params', async (request, reply) => {
    const {
      pageDirection = 'next',
      readingDirection = 'rtl',
      substrate = 'tankobon',
      volume = 0.65,
      stereoEnabled = true,
    } = request.body || {};

    const result = calculateAudioPannerParams(
      pageDirection,
      readingDirection,
      substrate,
      volume,
      stereoEnabled
    );

    return reply.status(200).send({
      success: true,
      params: result,
    });
  });

  /**
   * GET /api/v1/acoustics/substrates
   * Returns list of canonical paper substrate configs
   */
  fastify.get('/api/v1/acoustics/substrates', async (_request, reply) => {
    return reply.status(200).send({
      success: true,
      substrates: CANONICAL_SUBSTRATE_CONFIGS,
    });
  });
};
