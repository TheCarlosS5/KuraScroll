/**
 * KuraScroll - Sprint 130: Subpixel Matte Paper Specular Reflection & Angular Lighting Modulator Routes
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  PaperLightingService,
  PaperLightingPresetName,
  PAPER_LIGHTING_PRESETS,
  calculatePaperLighting,
} from '../services/paper-lighting-service.js';

export interface PaperLightingRoutesOptions {
  db: DatabaseInstance;
  paperLightingService?: PaperLightingService;
}

export function computePaperLightingEtag(
  seriesId: string,
  presetName: string,
  lightX: number,
  lightY: number,
  lightZ: number,
  diffuseKd: number,
  specularKs: number,
  roughness: number,
  inkAbsorption: number,
  ambientKa: number,
  isEnabled: boolean,
  updatedAt: number
): string {
  return `"pl-${seriesId}-${presetName}-${lightX}-${lightY}-${lightZ}-${diffuseKd}-${specularKs}-${roughness}-${inkAbsorption}-${ambientKa}-${isEnabled ? 1 : 0}-${updatedAt}"`;
}

export const paperLightingRoutes: FastifyPluginAsync<PaperLightingRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: PaperLightingRoutesOptions
) => {
  const service = opts.paperLightingService ?? new PaperLightingService(opts.db);

  /**
   * GET /api/v1/reader/paper-lighting/presets
   */
  fastify.get('/api/v1/reader/paper-lighting/presets', async (_request, reply) => {
    return reply.status(200).send({
      success: true,
      presets: PAPER_LIGHTING_PRESETS,
    });
  });

  /**
   * GET /api/v1/reader/paper-lighting/profile/:seriesId
   */
  fastify.get<{
    Params: { seriesId: string };
  }>('/api/v1/reader/paper-lighting/profile/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;

    if (!seriesId || seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid or missing seriesId parameter',
      });
    }

    const profile = service.getProfile(seriesId);
    const etag = computePaperLightingEtag(
      profile.seriesId,
      profile.presetName,
      profile.lightX,
      profile.lightY,
      profile.lightZ,
      profile.diffuseKd,
      profile.specularKs,
      profile.roughness,
      profile.inkAbsorption,
      profile.ambientKa,
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
   * PUT /api/v1/reader/paper-lighting/profile/:seriesId
   */
  fastify.put<{
    Params: { seriesId: string };
    Body: {
      presetName?: PaperLightingPresetName;
      lightX?: number;
      lightY?: number;
      lightZ?: number;
      diffuseKd?: number;
      specularKs?: number;
      roughness?: number;
      inkAbsorption?: number;
      ambientKa?: number;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/paper-lighting/profile/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;

    if (!seriesId || seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid or missing seriesId parameter',
      });
    }

    const body = request.body || {};

    if (body.presetName && !PAPER_LIGHTING_PRESETS[body.presetName]) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: `Invalid presetName: ${body.presetName}`,
      });
    }

    if (body.lightX !== undefined && (body.lightX < -2.0 || body.lightX > 3.0)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'lightX must be between -2.0 and 3.0',
      });
    }

    if (body.lightY !== undefined && (body.lightY < -2.0 || body.lightY > 3.0)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'lightY must be between -2.0 and 3.0',
      });
    }

    if (body.lightZ !== undefined && (body.lightZ < 0.10 || body.lightZ > 5.0)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'lightZ must be between 0.10 and 5.0',
      });
    }

    if (body.diffuseKd !== undefined && (body.diffuseKd < 0.0 || body.diffuseKd > 2.0)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'diffuseKd must be between 0.0 and 2.0',
      });
    }

    if (body.specularKs !== undefined && (body.specularKs < 0.0 || body.specularKs > 1.0)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'specularKs must be between 0.0 and 1.0',
      });
    }

    if (body.roughness !== undefined && (body.roughness < 0.05 || body.roughness > 1.0)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'roughness must be between 0.05 and 1.0',
      });
    }

    if (body.inkAbsorption !== undefined && (body.inkAbsorption < 0.0 || body.inkAbsorption > 1.0)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'inkAbsorption must be between 0.0 and 1.0',
      });
    }

    if (body.ambientKa !== undefined && (body.ambientKa < 0.0 || body.ambientKa > 1.0)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'ambientKa must be between 0.0 and 1.0',
      });
    }

    const updated = service.saveProfile(seriesId, body);
    const etag = computePaperLightingEtag(
      updated.seriesId,
      updated.presetName,
      updated.lightX,
      updated.lightY,
      updated.lightZ,
      updated.diffuseKd,
      updated.specularKs,
      updated.roughness,
      updated.inkAbsorption,
      updated.ambientKa,
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
   * POST /api/v1/reader/paper-lighting/simulate
   */
  fastify.post<{
    Body: {
      pixelXNorm: number;
      pixelYNorm: number;
      inR: number;
      inG: number;
      inB: number;
      lightX?: number;
      lightY?: number;
      lightZ?: number;
      diffuseKd?: number;
      specularKs?: number;
      roughness?: number;
      inkAbsorption?: number;
      ambientKa?: number;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/paper-lighting/simulate', async (request, reply) => {
    const {
      pixelXNorm,
      pixelYNorm,
      inR,
      inG,
      inB,
      lightX = 0.50,
      lightY = 0.30,
      lightZ = 1.20,
      diffuseKd = 0.85,
      specularKs = 0.12,
      roughness = 0.45,
      inkAbsorption = 0.85,
      ambientKa = 0.20,
      isEnabled = true,
    } = request.body || {};

    if (
      pixelXNorm === undefined ||
      pixelYNorm === undefined ||
      inR === undefined ||
      inG === undefined ||
      inB === undefined
    ) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'pixelXNorm, pixelYNorm, inR, inG, and inB are required',
      });
    }

    const result = calculatePaperLighting(
      pixelXNorm,
      pixelYNorm,
      inR,
      inG,
      inB,
      lightX,
      lightY,
      lightZ,
      diffuseKd,
      specularKs,
      roughness,
      inkAbsorption,
      ambientKa,
      isEnabled
    );

    return reply.status(200).send({
      success: true,
      result: {
        inR: result.inR,
        inG: result.inG,
        inB: result.inB,
        outR: result.outR,
        outG: result.outG,
        outB: result.outB,
        diffuseIntensity: result.diffuseIntensity,
        specularIntensity: result.specularIntensity,
        inkGuard: result.inkGuard,
        attenuation: result.attenuation,
        latencyUs: result.latencyUs,
      },
    });
  });
};
