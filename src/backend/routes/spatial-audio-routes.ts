/**
 * KuraScroll - Sprint 120: Spatial Audio Reverberation Occlusion & Distance Attenuation Engine Routes
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  SpatialAudioService,
  SpatialAudioPresetName,
  calculateSpatialAudio,
  SPATIAL_AUDIO_PRESETS,
} from '../services/spatial-audio-service.js';

export interface SpatialAudioRoutesOptions {
  db: DatabaseInstance;
  spatialAudioService?: SpatialAudioService;
}

export function computeSpatialAudioEtag(
  seriesId: string,
  presetName: string,
  referenceDistancePx: number,
  rolloffFactor: number,
  minGain: number,
  maxDistancePx: number,
  panRadiusPx: number,
  cutoffOpenHz: number,
  cutoffClosedHz: number,
  filterQ: number,
  isEnabled: boolean,
  updatedAt: number
): string {
  return `"sa-${seriesId}-${presetName}-${referenceDistancePx}-${rolloffFactor}-${minGain}-${maxDistancePx}-${panRadiusPx}-${cutoffOpenHz}-${cutoffClosedHz}-${filterQ}-${isEnabled ? 1 : 0}-${updatedAt}"`;
}

export const spatialAudioRoutes: FastifyPluginAsync<SpatialAudioRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: SpatialAudioRoutesOptions
) => {
  const service = opts.spatialAudioService ?? new SpatialAudioService(opts.db);

  /**
   * GET /api/v1/reader/spatial-audio/presets
   * Retrieves all available spatial audio presets
   */
  fastify.get('/api/v1/reader/spatial-audio/presets', async (_request, reply) => {
    return reply.status(200).send({
      success: true,
      presets: SPATIAL_AUDIO_PRESETS,
    });
  });

  /**
   * GET /api/v1/reader/spatial-audio/profile/:seriesId
   * Retrieves active profile with ETag caching
   */
  fastify.get<{
    Params: { seriesId: string };
  }>('/api/v1/reader/spatial-audio/profile/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;

    if (!seriesId || seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid or missing seriesId parameter',
      });
    }

    const profile = service.getProfile(seriesId);
    const etag = computeSpatialAudioEtag(
      profile.seriesId,
      profile.presetName,
      profile.referenceDistancePx,
      profile.rolloffFactor,
      profile.minGain,
      profile.maxDistancePx,
      profile.panRadiusPx,
      profile.cutoffOpenHz,
      profile.cutoffClosedHz,
      profile.filterQ,
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
   * POST /api/v1/reader/spatial-audio/profile
   * Saves or updates spatial audio profile
   */
  fastify.post<{
    Body: {
      seriesId: string;
      presetName?: SpatialAudioPresetName;
      referenceDistancePx?: number;
      rolloffFactor?: number;
      minGain?: number;
      maxDistancePx?: number;
      panRadiusPx?: number;
      cutoffOpenHz?: number;
      cutoffClosedHz?: number;
      filterQ?: number;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/spatial-audio/profile', async (request, reply) => {
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
      referenceDistancePx: body.referenceDistancePx,
      rolloffFactor: body.rolloffFactor,
      minGain: body.minGain,
      maxDistancePx: body.maxDistancePx,
      panRadiusPx: body.panRadiusPx,
      cutoffOpenHz: body.cutoffOpenHz,
      cutoffClosedHz: body.cutoffClosedHz,
      filterQ: body.filterQ,
      isEnabled: body.isEnabled,
    });

    return reply.status(200).send({ success: true, profile: updated });
  });

  /**
   * POST /api/v1/reader/spatial-audio/calculate
   * Real-time zero-allocation spatial attenuation & panning calculation
   */
  fastify.post<{
    Body: {
      sourceX: number;
      sourceY: number;
      listenerX: number;
      listenerY: number;
      occlusionFactor?: number;
      referenceDistancePx?: number;
      rolloffFactor?: number;
      minGain?: number;
      maxDistancePx?: number;
      panRadiusPx?: number;
      cutoffOpenHz?: number;
      cutoffClosedHz?: number;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/spatial-audio/calculate', async (request, reply) => {
    const {
      sourceX,
      sourceY,
      listenerX,
      listenerY,
      occlusionFactor,
      referenceDistancePx,
      rolloffFactor,
      minGain,
      maxDistancePx,
      panRadiusPx,
      cutoffOpenHz,
      cutoffClosedHz,
      isEnabled,
    } = request.body ?? {};

    if (
      sourceX === undefined ||
      sourceY === undefined ||
      listenerX === undefined ||
      listenerY === undefined
    ) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Missing required source or listener coordinates (sourceX, sourceY, listenerX, listenerY)',
      });
    }

    const result = calculateSpatialAudio(
      sourceX,
      sourceY,
      listenerX,
      listenerY,
      occlusionFactor,
      referenceDistancePx,
      rolloffFactor,
      minGain,
      maxDistancePx,
      panRadiusPx,
      cutoffOpenHz,
      cutoffClosedHz,
      isEnabled
    );

    return reply.status(200).send({
      success: true,
      result,
    });
  });
};
