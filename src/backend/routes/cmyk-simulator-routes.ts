/**
 * KuraScroll - Sprint 128: Perceptual Color Gamut Mapping & CMYK Ink Density Simulator Routes
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  CmykSimulatorService,
  CmykSimulatorPresetName,
  CMYK_SIMULATOR_PRESETS,
  calculateCmykSimulation,
} from '../services/cmyk-simulator-service.js';

export interface CmykSimulatorRoutesOptions {
  db: DatabaseInstance;
  cmykSimulatorService?: CmykSimulatorService;
}

export function computeCmykSimulatorEtag(
  seriesId: string,
  presetName: string,
  tacLimit: number,
  dotGain: number,
  blackAbsorption: number,
  gamutCompression: number,
  isEnabled: boolean,
  updatedAt: number
): string {
  return `"cmyk-${seriesId}-${presetName}-${tacLimit}-${dotGain}-${blackAbsorption}-${gamutCompression}-${isEnabled ? 1 : 0}-${updatedAt}"`;
}

export const cmykSimulatorRoutes: FastifyPluginAsync<CmykSimulatorRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: CmykSimulatorRoutesOptions
) => {
  const service = opts.cmykSimulatorService ?? new CmykSimulatorService(opts.db);

  /**
   * GET /api/v1/reader/cmyk-simulator/presets
   */
  fastify.get('/api/v1/reader/cmyk-simulator/presets', async (_request, reply) => {
    return reply.status(200).send({
      success: true,
      presets: CMYK_SIMULATOR_PRESETS,
    });
  });

  /**
   * GET /api/v1/reader/cmyk-simulator/profile/:seriesId
   */
  fastify.get<{
    Params: { seriesId: string };
  }>('/api/v1/reader/cmyk-simulator/profile/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;

    if (!seriesId || seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid or missing seriesId parameter',
      });
    }

    const profile = service.getProfile(seriesId);
    const etag = computeCmykSimulatorEtag(
      profile.seriesId,
      profile.presetName,
      profile.tacLimit,
      profile.dotGain,
      profile.blackAbsorption,
      profile.gamutCompression,
      profile.isEnabled,
      profile.updatedAt
    );

    if (request.headers['if-none-match'] === etag) {
      return reply.status(304).send();
    }

    reply.header('ETag', etag);
    reply.header('Cache-Control', 'private, no-cache');
    return reply.status(200).send({
      success: true,
      profile,
    });
  });

  /**
   * PUT /api/v1/reader/cmyk-simulator/profile/:seriesId
   */
  fastify.put<{
    Params: { seriesId: string };
    Body: {
      presetName?: CmykSimulatorPresetName;
      tacLimit?: number;
      dotGain?: number;
      blackAbsorption?: number;
      gamutCompression?: number;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/cmyk-simulator/profile/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;

    if (!seriesId || seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid or missing seriesId parameter',
      });
    }

    const body = request.body || {};

    if (body.presetName && !CMYK_SIMULATOR_PRESETS[body.presetName]) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: `Invalid presetName: ${body.presetName}`,
      });
    }

    if (body.tacLimit !== undefined && (body.tacLimit < 1.50 || body.tacLimit > 4.00)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'tacLimit must be between 1.50 and 4.00',
      });
    }

    if (body.dotGain !== undefined && (body.dotGain < 0.0 || body.dotGain > 0.50)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'dotGain must be between 0.0 and 0.50',
      });
    }

    if (body.blackAbsorption !== undefined && (body.blackAbsorption < 0.0 || body.blackAbsorption > 0.50)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'blackAbsorption must be between 0.0 and 0.50',
      });
    }

    if (body.gamutCompression !== undefined && (body.gamutCompression < 0.0 || body.gamutCompression > 1.00)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'gamutCompression must be between 0.0 and 1.00',
      });
    }

    const updated = service.saveProfile(seriesId, body);
    const etag = computeCmykSimulatorEtag(
      updated.seriesId,
      updated.presetName,
      updated.tacLimit,
      updated.dotGain,
      updated.blackAbsorption,
      updated.gamutCompression,
      updated.isEnabled,
      updated.updatedAt
    );

    reply.header('ETag', etag);
    return reply.status(200).send({
      success: true,
      profile: updated,
    });
  });

  /**
   * POST /api/v1/reader/cmyk-simulator/evaluate
   */
  fastify.post<{
    Body: {
      r?: number;
      g?: number;
      b?: number;
      tacLimit?: number;
      dotGain?: number;
      blackAbsorption?: number;
      gamutCompression?: number;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/cmyk-simulator/evaluate', async (request, reply) => {
    const {
      r = 200,
      g = 80,
      b = 40,
      tacLimit = 2.80,
      dotGain = 0.10,
      blackAbsorption = 0.10,
      gamutCompression = 0.15,
      isEnabled = true,
    } = request.body || {};

    const result = calculateCmykSimulation(
      r,
      g,
      b,
      tacLimit,
      dotGain,
      blackAbsorption,
      gamutCompression,
      isEnabled
    );

    return reply.status(200).send({
      success: true,
      result,
    });
  });
};
