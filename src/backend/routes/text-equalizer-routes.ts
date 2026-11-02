/**
 * KuraScroll - Sprint 97: Adaptive Dynamic Range In-Viewport Text & Kanji Equalizer Fastify Routes
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  TextEqualizerService,
  TextEqualizerProfile,
  EqualizerMode,
  TEXT_EQUALIZER_PRESETS,
} from '../services/text-equalizer-service.js';

export interface TextEqualizerRoutesOptions {
  db: DatabaseInstance;
  textEqualizerService?: TextEqualizerService;
}

export function computeTextEqualizerEtag(
  seriesId: string,
  equalizerMode: string,
  blackLevelBoost: number,
  whiteLevelCompression: number,
  kanjiClarityFactor: number,
  isFuriganaSharpenEnabled: boolean,
  isEnabled: boolean,
  updatedAt: number
): string {
  return `"te-${seriesId}-${equalizerMode}-${blackLevelBoost}-${whiteLevelCompression}-${kanjiClarityFactor}-${isFuriganaSharpenEnabled ? 1 : 0}-${isEnabled ? 1 : 0}-${updatedAt}"`;
}

export const textEqualizerRoutes: FastifyPluginAsync<TextEqualizerRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: TextEqualizerRoutesOptions
) => {
  const service = opts.textEqualizerService ?? new TextEqualizerService(opts.db);

  /**
   * GET /api/v1/reader/text-equalizer/profile/:seriesId
   * Retrieves active profile with ETag caching
   */
  fastify.get<{
    Params: { seriesId: string };
  }>('/api/v1/reader/text-equalizer/profile/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;

    if (!seriesId || seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid seriesId parameter',
      });
    }

    const profile = service.getProfile(seriesId);
    const etag = computeTextEqualizerEtag(
      profile.seriesId,
      profile.equalizerMode,
      profile.blackLevelBoost,
      profile.whiteLevelCompression,
      profile.kanjiClarityFactor,
      profile.isFuriganaSharpenEnabled,
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
   * POST /api/v1/reader/text-equalizer/profile
   * Saves or updates a text equalizer profile
   */
  fastify.post<{
    Body: {
      seriesId: string;
      equalizerMode?: EqualizerMode;
      blackLevelBoost?: number;
      whiteLevelCompression?: number;
      kanjiClarityFactor?: number;
      isFuriganaSharpenEnabled?: boolean;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/text-equalizer/profile', async (request, reply) => {
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
      equalizerMode: body.equalizerMode ?? current.equalizerMode,
      blackLevelBoost: body.blackLevelBoost ?? current.blackLevelBoost,
      whiteLevelCompression: body.whiteLevelCompression ?? current.whiteLevelCompression,
      kanjiClarityFactor: body.kanjiClarityFactor ?? current.kanjiClarityFactor,
      isFuriganaSharpenEnabled: body.isFuriganaSharpenEnabled !== undefined ? body.isFuriganaSharpenEnabled : current.isFuriganaSharpenEnabled,
      isEnabled: body.isEnabled !== undefined ? body.isEnabled : current.isEnabled,
      updatedAt: Date.now(),
    });

    return reply.status(200).send({ success: true, profile: updated });
  });

  /**
   * POST /api/v1/reader/text-equalizer/calculate-equalizer-matrix
   * Evaluates text and kanji dynamic range matrix in sub-20 microseconds
   */
  fastify.post<{
    Body: {
      blackBoost?: number;
      whiteCompression?: number;
      kanjiClarity?: number;
      isFuriganaSharpen?: boolean;
      mode?: EqualizerMode;
    };
  }>('/api/v1/reader/text-equalizer/calculate-equalizer-matrix', async (request, reply) => {
    const {
      blackBoost,
      whiteCompression,
      kanjiClarity,
      isFuriganaSharpen,
      mode,
    } = request.body || {};

    const result = service.calculateTextEqualizerParams(
      blackBoost ?? 0.35,
      whiteCompression ?? 0.20,
      kanjiClarity ?? 1.30,
      isFuriganaSharpen ?? true,
      mode ?? 'newsprint_vintage'
    );

    return reply.status(200).send({ success: true, result });
  });

  /**
   * GET /api/v1/reader/text-equalizer/presets
   * Lists predefined text equalizer configurations
   */
  fastify.get('/api/v1/reader/text-equalizer/presets', async (_request, reply) => {
    return reply.status(200).send({
      success: true,
      presets: TEXT_EQUALIZER_PRESETS,
    });
  });
};
