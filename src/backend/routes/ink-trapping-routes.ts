/**
 * KuraScroll - Sprint 131: Subpixel Mechanical Rotary Press Plate Misregistration & Ink Trapping Compensator Routes
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  InkTrappingService,
  InkTrappingPresetName,
  InkTrappingMode,
  INK_TRAPPING_PRESETS,
  calculateInkTrapping,
} from '../services/ink-trapping-service.js';

export interface InkTrappingRoutesOptions {
  db: DatabaseInstance;
  inkTrappingService?: InkTrappingService;
}

export function computeInkTrappingEtag(
  seriesId: string,
  presetName: string,
  shiftCx: number,
  shiftCy: number,
  shiftMx: number,
  shiftMy: number,
  shiftYx: number,
  shiftYy: number,
  shiftKx: number,
  shiftKy: number,
  trapWidth: number,
  trapMode: string,
  edgeThreshold: number,
  isEnabled: boolean,
  updatedAt: number
): string {
  return `"it-${seriesId}-${presetName}-${shiftCx}-${shiftCy}-${shiftMx}-${shiftMy}-${shiftYx}-${shiftYy}-${shiftKx}-${shiftKy}-${trapWidth}-${trapMode}-${edgeThreshold}-${isEnabled ? 1 : 0}-${updatedAt}"`;
}

export const inkTrappingRoutes: FastifyPluginAsync<InkTrappingRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: InkTrappingRoutesOptions
) => {
  const service = opts.inkTrappingService ?? new InkTrappingService(opts.db);

  /**
   * GET /api/v1/reader/ink-trapping/presets
   */
  fastify.get('/api/v1/reader/ink-trapping/presets', async (_request, reply) => {
    return reply.status(200).send({
      success: true,
      presets: INK_TRAPPING_PRESETS,
    });
  });

  /**
   * GET /api/v1/reader/ink-trapping/profile/:seriesId
   */
  fastify.get<{
    Params: { seriesId: string };
  }>('/api/v1/reader/ink-trapping/profile/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;

    if (!seriesId || seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid or missing seriesId parameter',
      });
    }

    const profile = service.getProfile(seriesId);
    const etag = computeInkTrappingEtag(
      profile.seriesId,
      profile.presetName,
      profile.shiftCx,
      profile.shiftCy,
      profile.shiftMx,
      profile.shiftMy,
      profile.shiftYx,
      profile.shiftYy,
      profile.shiftKx,
      profile.shiftKy,
      profile.trapWidth,
      profile.trapMode,
      profile.edgeThreshold,
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
   * PUT /api/v1/reader/ink-trapping/profile/:seriesId
   */
  fastify.put<{
    Params: { seriesId: string };
    Body: {
      presetName?: InkTrappingPresetName;
      shiftCx?: number;
      shiftCy?: number;
      shiftMx?: number;
      shiftMy?: number;
      shiftYx?: number;
      shiftYy?: number;
      shiftKx?: number;
      shiftKy?: number;
      trapWidth?: number;
      trapMode?: InkTrappingMode;
      edgeThreshold?: number;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/ink-trapping/profile/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;

    if (!seriesId || seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid or missing seriesId parameter',
      });
    }

    const body = request.body || {};

    if (body.presetName && !INK_TRAPPING_PRESETS[body.presetName]) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: `Invalid presetName: ${body.presetName}`,
      });
    }

    if (body.shiftCx !== undefined && (body.shiftCx < -3.0 || body.shiftCx > 3.0)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'shiftCx must be between -3.0 and 3.0',
      });
    }

    if (body.shiftCy !== undefined && (body.shiftCy < -3.0 || body.shiftCy > 3.0)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'shiftCy must be between -3.0 and 3.0',
      });
    }

    if (body.shiftMx !== undefined && (body.shiftMx < -3.0 || body.shiftMx > 3.0)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'shiftMx must be between -3.0 and 3.0',
      });
    }

    if (body.shiftMy !== undefined && (body.shiftMy < -3.0 || body.shiftMy > 3.0)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'shiftMy must be between -3.0 and 3.0',
      });
    }

    if (body.shiftYx !== undefined && (body.shiftYx < -3.0 || body.shiftYx > 3.0)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'shiftYx must be between -3.0 and 3.0',
      });
    }

    if (body.shiftYy !== undefined && (body.shiftYy < -3.0 || body.shiftYy > 3.0)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'shiftYy must be between -3.0 and 3.0',
      });
    }

    if (body.shiftKx !== undefined && (body.shiftKx < -3.0 || body.shiftKx > 3.0)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'shiftKx must be between -3.0 and 3.0',
      });
    }

    if (body.shiftKy !== undefined && (body.shiftKy < -3.0 || body.shiftKy > 3.0)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'shiftKy must be between -3.0 and 3.0',
      });
    }

    if (body.trapWidth !== undefined && (body.trapWidth < 0.0 || body.trapWidth > 2.0)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'trapWidth must be between 0.0 and 2.0',
      });
    }

    if (body.trapMode !== undefined && !['spread', 'choke', 'auto'].includes(body.trapMode)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: "trapMode must be 'spread', 'choke', or 'auto'",
      });
    }

    if (body.edgeThreshold !== undefined && (body.edgeThreshold < 0.01 || body.edgeThreshold > 1.0)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'edgeThreshold must be between 0.01 and 1.0',
      });
    }

    const updated = service.saveProfile(seriesId, body);
    const etag = computeInkTrappingEtag(
      updated.seriesId,
      updated.presetName,
      updated.shiftCx,
      updated.shiftCy,
      updated.shiftMx,
      updated.shiftMy,
      updated.shiftYx,
      updated.shiftYy,
      updated.shiftKx,
      updated.shiftKy,
      updated.trapWidth,
      updated.trapMode,
      updated.edgeThreshold,
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
   * POST /api/v1/reader/ink-trapping/simulate
   */
  fastify.post<{
    Body: {
      inR: number;
      inG: number;
      inB: number;
      gradX?: number;
      gradY?: number;
      shiftCx?: number;
      shiftCy?: number;
      shiftMx?: number;
      shiftMy?: number;
      shiftYx?: number;
      shiftYy?: number;
      shiftKx?: number;
      shiftKy?: number;
      trapWidth?: number;
      trapMode?: InkTrappingMode;
      edgeThreshold?: number;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/ink-trapping/simulate', async (request, reply) => {
    const {
      inR,
      inG,
      inB,
      gradX = 0.0,
      gradY = 0.0,
      shiftCx = 0.60,
      shiftCy = -0.40,
      shiftMx = -0.30,
      shiftMy = 0.50,
      shiftYx = 0.20,
      shiftYy = 0.40,
      shiftKx = 0.00,
      shiftKy = 0.00,
      trapWidth = 0.35,
      trapMode = 'auto',
      edgeThreshold = 0.15,
      isEnabled = true,
    } = request.body || {};

    if (inR === undefined || inG === undefined || inB === undefined) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'inR, inG, and inB are required',
      });
    }

    const result = calculateInkTrapping(
      inR,
      inG,
      inB,
      gradX,
      gradY,
      shiftCx,
      shiftCy,
      shiftMx,
      shiftMy,
      shiftYx,
      shiftYy,
      shiftKx,
      shiftKy,
      trapWidth,
      trapMode,
      edgeThreshold,
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
        cEff: result.cEff,
        mEff: result.mEff,
        yEff: result.yEff,
        kEff: result.kEff,
        trapIntensity: result.trapIntensity,
        latencyUs: result.latencyUs,
      },
    });
  });
};
