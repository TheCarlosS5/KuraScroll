/**
 * KuraScroll - Sprint 108: Adaptive Per-Panel Visual Acoustic Echo & Spatial Reverberation Modulator Routes
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  AcousticReverbService,
  SceneEnvironment,
  calculateAcousticReverb,
  ACOUSTIC_REVERB_PRESETS,
} from '../services/acoustic-reverb-service.js';

export interface AcousticReverbRoutesOptions {
  db: DatabaseInstance;
  acousticReverbService?: AcousticReverbService;
}

export function computeAcousticReverbEtag(
  seriesId: string,
  sceneEnvironment: string,
  roomSizeM3: number,
  absorptionCoeff: number,
  t60DecayS: number,
  dampingFreqHz: number,
  wetDryMix: number,
  isEnabled: boolean,
  updatedAt: number
): string {
  return `"ar-${seriesId}-${sceneEnvironment}-${roomSizeM3}-${absorptionCoeff}-${t60DecayS}-${dampingFreqHz}-${wetDryMix}-${isEnabled ? 1 : 0}-${updatedAt}"`;
}

export const acousticReverbRoutes: FastifyPluginAsync<AcousticReverbRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: AcousticReverbRoutesOptions
) => {
  const service = opts.acousticReverbService ?? new AcousticReverbService(opts.db);

  /**
   * GET /api/v1/reader/acoustic-reverb/profile/:seriesId
   * Retrieves active profile with ETag caching
   */
  fastify.get<{
    Params: { seriesId: string };
  }>('/api/v1/reader/acoustic-reverb/profile/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;

    if (!seriesId || seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid or missing seriesId parameter',
      });
    }

    const profile = service.getProfile(seriesId);
    const etag = computeAcousticReverbEtag(
      profile.seriesId,
      profile.sceneEnvironment,
      profile.roomSizeM3,
      profile.absorptionCoeff,
      profile.t60DecayS,
      profile.dampingFreqHz,
      profile.wetDryMix,
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
   * POST /api/v1/reader/acoustic-reverb/profile
   * Saves or updates acoustic reverb profile
   */
  fastify.post<{
    Body: {
      seriesId: string;
      sceneEnvironment?: SceneEnvironment;
      roomSizeM3?: number;
      absorptionCoeff?: number;
      t60DecayS?: number;
      dampingFreqHz?: number;
      earlyReflectionsMs?: number[];
      wetDryMix?: number;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/acoustic-reverb/profile', async (request, reply) => {
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
      sceneEnvironment: body.sceneEnvironment,
      roomSizeM3: body.roomSizeM3,
      absorptionCoeff: body.absorptionCoeff,
      t60DecayS: body.t60DecayS,
      dampingFreqHz: body.dampingFreqHz,
      earlyReflectionsMs: body.earlyReflectionsMs,
      wetDryMix: body.wetDryMix,
      isEnabled: body.isEnabled,
    });

    return reply.status(200).send({ success: true, profile: updated });
  });

  /**
   * POST /api/v1/reader/acoustic-reverb/calculate
   * Real-time zero-allocation parametric reverb evaluation
   */
  fastify.post<{
    Body: {
      roomSizeM3?: number;
      absorptionCoeff?: number;
      t60DecayS?: number;
      dampingFreqHz?: number;
      wetDryMix?: number;
      earlyReflectionsMs?: number[];
      sceneEnvironment?: SceneEnvironment;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/acoustic-reverb/calculate', async (request, reply) => {
    const body = request.body ?? {};

    const result = calculateAcousticReverb(
      body.roomSizeM3 ?? 85.0,
      body.absorptionCoeff ?? 0.35,
      body.t60DecayS ?? 1.20,
      body.dampingFreqHz ?? 2800.0,
      body.wetDryMix ?? 0.28,
      body.earlyReflectionsMs ?? [18, 31, 47, 63],
      body.sceneEnvironment ?? 'confined_room',
      body.isEnabled ?? true
    );

    return reply.status(200).send({
      success: true,
      result,
    });
  });

  /**
   * GET /api/v1/reader/acoustic-reverb/presets
   * Retrieves predefined scene acoustic presets
   */
  fastify.get('/api/v1/reader/acoustic-reverb/presets', async (_request, reply) => {
    return reply.status(200).send({
      success: true,
      presets: service.getPresets(),
    });
  });
};
