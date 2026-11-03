/**
 * KuraScroll - Sprint 118: Adaptive Perceptual Dark-Adaptation Retinal Preserver & Contrast Compensator Routes
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  DarkAdaptationService,
  DarkAdaptationPresetName,
  calculateDarkAdaptation,
  DARK_ADAPTATION_PRESETS,
} from '../services/dark-adaptation-service.js';

export interface DarkAdaptationRoutesOptions {
  db: DatabaseInstance;
  darkAdaptationService?: DarkAdaptationService;
}

export function computeDarkAdaptationEtag(
  seriesId: string,
  presetName: string,
  tauDarkMs: number,
  tauBrightMs: number,
  comfortLuminance: number,
  glareThreshold: number,
  baseWhitePoint: number,
  glareAttenuation: number,
  contrastBase: number,
  contrastCompensation: number,
  isEnabled: boolean,
  updatedAt: number
): string {
  return `"da-${seriesId}-${presetName}-${tauDarkMs}-${tauBrightMs}-${comfortLuminance}-${glareThreshold}-${baseWhitePoint}-${glareAttenuation}-${contrastBase}-${contrastCompensation}-${isEnabled ? 1 : 0}-${updatedAt}"`;
}

export const darkAdaptationRoutes: FastifyPluginAsync<DarkAdaptationRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: DarkAdaptationRoutesOptions
) => {
  const service = opts.darkAdaptationService ?? new DarkAdaptationService(opts.db);

  /**
   * GET /api/v1/reader/dark-adaptation/presets
   * Retrieves all available dark adaptation presets
   */
  fastify.get('/api/v1/reader/dark-adaptation/presets', async (_request, reply) => {
    return reply.status(200).send({
      success: true,
      presets: DARK_ADAPTATION_PRESETS,
    });
  });

  /**
   * GET /api/v1/reader/dark-adaptation/profile/:seriesId
   * Retrieves active profile with ETag caching
   */
  fastify.get<{
    Params: { seriesId: string };
  }>('/api/v1/reader/dark-adaptation/profile/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;

    if (!seriesId || seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid or missing seriesId parameter',
      });
    }

    const profile = service.getProfile(seriesId);
    const etag = computeDarkAdaptationEtag(
      profile.seriesId,
      profile.presetName,
      profile.tauDarkMs,
      profile.tauBrightMs,
      profile.comfortLuminance,
      profile.glareThreshold,
      profile.baseWhitePoint,
      profile.glareAttenuation,
      profile.contrastBase,
      profile.contrastCompensation,
      profile.isEnabled,
      profile.updatedAt
    );

    const clientEtag = request.headers['if-none-match'];
    if (clientEtag && clientEtag === etag) {
      return reply.status(304).send();
    }

    return reply
      .header('ETag', etag)
      .header('Cache-Control', 'private, no-cache')
      .status(200)
      .send({
        success: true,
        profile,
      });
  });

  /**
   * POST /api/v1/reader/dark-adaptation/profile
   * Saves or updates dark adaptation profile
   */
  fastify.post<{
    Body: {
      seriesId: string;
      presetName?: DarkAdaptationPresetName;
      tauDarkMs?: number;
      tauBrightMs?: number;
      comfortLuminance?: number;
      glareThreshold?: number;
      baseWhitePoint?: number;
      glareAttenuation?: number;
      contrastBase?: number;
      contrastCompensation?: number;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/dark-adaptation/profile', async (request, reply) => {
    const body = request.body;
    if (!body || !body.seriesId || body.seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Missing or empty seriesId',
      });
    }

    const updated = service.upsertProfile({
      seriesId: body.seriesId,
      presetName: body.presetName,
      tauDarkMs: body.tauDarkMs,
      tauBrightMs: body.tauBrightMs,
      comfortLuminance: body.comfortLuminance,
      glareThreshold: body.glareThreshold,
      baseWhitePoint: body.baseWhitePoint,
      glareAttenuation: body.glareAttenuation,
      contrastBase: body.contrastBase,
      contrastCompensation: body.contrastCompensation,
      isEnabled: body.isEnabled,
    });

    return reply.status(200).send({ success: true, profile: updated });
  });

  /**
   * POST /api/v1/reader/dark-adaptation/calculate
   * Real-time zero-allocation EMA adaptation & glare suppression calculation
   */
  fastify.post<{
    Body: {
      inputLuminance: number;
      prevAdaptedLuminance: number;
      dtMs?: number;
      tauDarkMs?: number;
      tauBrightMs?: number;
      comfortLuminance?: number;
      glareThreshold?: number;
      baseWhitePoint?: number;
      glareAttenuation?: number;
      contrastBase?: number;
      contrastCompensation?: number;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/dark-adaptation/calculate', async (request, reply) => {
    const {
      inputLuminance,
      prevAdaptedLuminance,
      dtMs,
      tauDarkMs,
      tauBrightMs,
      comfortLuminance,
      glareThreshold,
      baseWhitePoint,
      glareAttenuation,
      contrastBase,
      contrastCompensation,
      isEnabled,
    } = request.body ?? {};

    if (inputLuminance === undefined || prevAdaptedLuminance === undefined) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Missing required luminance parameters',
      });
    }

    const result = calculateDarkAdaptation(
      inputLuminance,
      prevAdaptedLuminance,
      dtMs,
      tauDarkMs,
      tauBrightMs,
      comfortLuminance,
      glareThreshold,
      baseWhitePoint,
      glareAttenuation,
      contrastBase,
      contrastCompensation,
      isEnabled
    );

    return reply.status(200).send({
      success: true,
      result,
    });
  });
};
