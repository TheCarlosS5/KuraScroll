/**
 * KuraScroll - Sprint 133: Cellulose Fiber Micro-Relief & Paper Grain Texture Engine Routes (SLA 97)
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  CelluloseReliefService,
  CelluloseReliefPresetName,
  CELLULOSE_RELIEF_PRESETS,
} from '../services/cellulose-relief-service.js';

export interface CelluloseReliefRoutesOptions {
  db: DatabaseInstance;
  celluloseReliefService?: CelluloseReliefService;
}

export function computeCelluloseReliefEtag(
  seriesId: string,
  presetName: string,
  grainScale: number,
  reliefDepth: number,
  fiberDensity: number,
  lightAngle: number,
  isEnabled: boolean,
  updatedAt: number
): string {
  return `"cr-${seriesId}-${presetName}-${grainScale}-${reliefDepth}-${fiberDensity}-${lightAngle}-${isEnabled ? 1 : 0}-${updatedAt}"`;
}

export const celluloseReliefRoutes: FastifyPluginAsync<CelluloseReliefRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: CelluloseReliefRoutesOptions
) => {
  const service = opts.celluloseReliefService ?? new CelluloseReliefService(opts.db);

  /**
   * GET /api/v1/reader/cellulose-relief/presets
   */
  fastify.get('/api/v1/reader/cellulose-relief/presets', async (_request, reply) => {
    return reply.status(200).send({
      success: true,
      presets: CELLULOSE_RELIEF_PRESETS,
    });
  });

  /**
   * GET /api/v1/reader/cellulose-relief/profile/:seriesId
   */
  fastify.get<{
    Params: { seriesId: string };
  }>('/api/v1/reader/cellulose-relief/profile/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;

    if (!seriesId || seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid or missing seriesId parameter',
      });
    }

    const profile = service.getProfile(seriesId);
    const etag = computeCelluloseReliefEtag(
      profile.seriesId,
      profile.presetName,
      profile.grainScale,
      profile.reliefDepth,
      profile.fiberDensity,
      profile.lightAngle,
      profile.isEnabled,
      profile.updatedAt
    );

    const clientEtag = request.headers['if-none-match'];
    if (clientEtag && clientEtag === etag) {
      return reply.status(304).send();
    }

    reply.header('ETag', etag);
    reply.header('Cache-Control', 'public, max-age=60, must-revalidate');

    return reply.status(200).send({
      success: true,
      profile,
    });
  });

  /**
   * PUT /api/v1/reader/cellulose-relief/profile/:seriesId
   */
  fastify.put<{
    Params: { seriesId: string };
    Body: {
      presetName?: CelluloseReliefPresetName;
      grainScale?: number;
      reliefDepth?: number;
      fiberDensity?: number;
      lightAngle?: number;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/cellulose-relief/profile/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;
    const body = request.body || {};

    if (!seriesId || seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid or missing seriesId parameter',
      });
    }

    if (body.grainScale !== undefined && (typeof body.grainScale !== 'number' || body.grainScale < 0.1 || body.grainScale > 5.0)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'grainScale must be a number between 0.1 and 5.0',
      });
    }

    if (body.reliefDepth !== undefined && (typeof body.reliefDepth !== 'number' || body.reliefDepth < 0.0 || body.reliefDepth > 1.0)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'reliefDepth must be a number between 0.0 and 1.0',
      });
    }

    if (body.fiberDensity !== undefined && (typeof body.fiberDensity !== 'number' || body.fiberDensity < 0.0 || body.fiberDensity > 1.0)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'fiberDensity must be a number between 0.0 and 1.0',
      });
    }

    if (body.lightAngle !== undefined && (typeof body.lightAngle !== 'number' || body.lightAngle < 0.0 || body.lightAngle > Math.PI / 2)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'lightAngle must be a number between 0.0 and PI/2 (~1.5708)',
      });
    }

    const updated = service.setProfile({
      seriesId,
      presetName: body.presetName,
      grainScale: body.grainScale,
      reliefDepth: body.reliefDepth,
      fiberDensity: body.fiberDensity,
      lightAngle: body.lightAngle,
      isEnabled: body.isEnabled,
    });

    const etag = computeCelluloseReliefEtag(
      updated.seriesId,
      updated.presetName,
      updated.grainScale,
      updated.reliefDepth,
      updated.fiberDensity,
      updated.lightAngle,
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
   * POST /api/v1/reader/cellulose-relief/preset/:seriesId
   */
  fastify.post<{
    Params: { seriesId: string };
    Body: {
      presetName: CelluloseReliefPresetName;
    };
  }>('/api/v1/reader/cellulose-relief/preset/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;
    const { presetName } = request.body || {};

    if (!seriesId || seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid or missing seriesId parameter',
      });
    }

    if (!presetName || !CELLULOSE_RELIEF_PRESETS[presetName]) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: `Invalid presetName. Must be one of: ${Object.keys(CELLULOSE_RELIEF_PRESETS).join(', ')}`,
      });
    }

    const updated = service.applyPreset(seriesId, presetName);
    const etag = computeCelluloseReliefEtag(
      updated.seriesId,
      updated.presetName,
      updated.grainScale,
      updated.reliefDepth,
      updated.fiberDensity,
      updated.lightAngle,
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
   * DELETE /api/v1/reader/cellulose-relief/profile/:seriesId
   */
  fastify.delete<{
    Params: { seriesId: string };
  }>('/api/v1/reader/cellulose-relief/profile/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;

    if (!seriesId || seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid or missing seriesId parameter',
      });
    }

    const deleted = service.deleteProfile(seriesId);
    return reply.status(200).send({
      success: true,
      deleted,
    });
  });

  /**
   * POST /api/v1/reader/cellulose-relief/evaluate
   */
  fastify.post<{
    Body: {
      x: number;
      y: number;
      kDensity: number;
      profile?: {
        grainScale?: number;
        reliefDepth?: number;
        fiberDensity?: number;
        lightAngle?: number;
        isEnabled?: boolean;
      };
    };
  }>('/api/v1/reader/cellulose-relief/evaluate', async (request, reply) => {
    const { x = 0, y = 0, kDensity = 0, profile } = request.body || {};

    const result = service.evaluateRelief(x, y, kDensity, profile as any);

    return reply.status(200).send({
      success: true,
      result,
    });
  });
};
