/**
 * KuraScroll - Sprint 134: Dynamic Ink Splatter & Bleed Feathering Physics Routes (SLA 98)
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  InkSplatterService,
  InkSplatterPresetName,
  INK_SPLATTER_PRESETS,
} from '../services/ink-splatter-service.js';

export interface InkSplatterRoutesOptions {
  db: DatabaseInstance;
  inkSplatterService?: InkSplatterService;
}

export function computeInkSplatterEtag(
  seriesId: string,
  presetName: string,
  strokeVelocity: number,
  bleedRadiusPx: number,
  splatterDensity: number,
  wickingRate: number,
  isEnabled: boolean,
  updatedAt: number
): string {
  return `"is-${seriesId}-${presetName}-${strokeVelocity}-${bleedRadiusPx}-${splatterDensity}-${wickingRate}-${isEnabled ? 1 : 0}-${updatedAt}"`;
}

export const inkSplatterRoutes: FastifyPluginAsync<InkSplatterRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: InkSplatterRoutesOptions
) => {
  const service = opts.inkSplatterService ?? new InkSplatterService(opts.db);

  /**
   * GET /api/v1/reader/ink-splatter/presets
   */
  fastify.get('/api/v1/reader/ink-splatter/presets', async (_request, reply) => {
    return reply.status(200).send({
      success: true,
      presets: INK_SPLATTER_PRESETS,
    });
  });

  /**
   * GET /api/v1/reader/ink-splatter/profile/:seriesId
   */
  fastify.get<{
    Params: { seriesId: string };
  }>('/api/v1/reader/ink-splatter/profile/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;

    if (!seriesId || seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid or missing seriesId parameter',
      });
    }

    const profile = service.getProfile(seriesId);
    const etag = computeInkSplatterEtag(
      profile.seriesId,
      profile.presetName,
      profile.strokeVelocity,
      profile.bleedRadiusPx,
      profile.splatterDensity,
      profile.wickingRate,
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
   * PUT /api/v1/reader/ink-splatter/profile/:seriesId
   */
  fastify.put<{
    Params: { seriesId: string };
    Body: {
      presetName?: InkSplatterPresetName;
      strokeVelocity?: number;
      bleedRadiusPx?: number;
      splatterDensity?: number;
      wickingRate?: number;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/ink-splatter/profile/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;
    const body = request.body || {};

    if (!seriesId || seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid or missing seriesId parameter',
      });
    }

    if (body.strokeVelocity !== undefined && (typeof body.strokeVelocity !== 'number' || body.strokeVelocity < 0.0 || body.strokeVelocity > 1000.0)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'strokeVelocity must be a number between 0.0 and 1000.0',
      });
    }

    if (body.bleedRadiusPx !== undefined && (typeof body.bleedRadiusPx !== 'number' || body.bleedRadiusPx < 0.0 || body.bleedRadiusPx > 5.0)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'bleedRadiusPx must be a number between 0.0 and 5.0',
      });
    }

    if (body.splatterDensity !== undefined && (typeof body.splatterDensity !== 'number' || body.splatterDensity < 0.0 || body.splatterDensity > 1.0)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'splatterDensity must be a number between 0.0 and 1.0',
      });
    }

    if (body.wickingRate !== undefined && (typeof body.wickingRate !== 'number' || body.wickingRate < 0.0 || body.wickingRate > 1.0)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'wickingRate must be a number between 0.0 and 1.0',
      });
    }

    const updated = service.setProfile({
      seriesId,
      presetName: body.presetName,
      strokeVelocity: body.strokeVelocity,
      bleedRadiusPx: body.bleedRadiusPx,
      splatterDensity: body.splatterDensity,
      wickingRate: body.wickingRate,
      isEnabled: body.isEnabled,
    });

    const etag = computeInkSplatterEtag(
      updated.seriesId,
      updated.presetName,
      updated.strokeVelocity,
      updated.bleedRadiusPx,
      updated.splatterDensity,
      updated.wickingRate,
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
   * POST /api/v1/reader/ink-splatter/preset/:seriesId
   */
  fastify.post<{
    Params: { seriesId: string };
    Body: {
      presetName: InkSplatterPresetName;
    };
  }>('/api/v1/reader/ink-splatter/preset/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;
    const { presetName } = request.body || {};

    if (!seriesId || seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid or missing seriesId parameter',
      });
    }

    if (!presetName || !INK_SPLATTER_PRESETS[presetName]) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: `Invalid presetName. Must be one of: ${Object.keys(INK_SPLATTER_PRESETS).join(', ')}`,
      });
    }

    const updated = service.applyPreset(seriesId, presetName);
    const etag = computeInkSplatterEtag(
      updated.seriesId,
      updated.presetName,
      updated.strokeVelocity,
      updated.bleedRadiusPx,
      updated.splatterDensity,
      updated.wickingRate,
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
   * DELETE /api/v1/reader/ink-splatter/profile/:seriesId
   */
  fastify.delete<{
    Params: { seriesId: string };
  }>('/api/v1/reader/ink-splatter/profile/:seriesId', async (request, reply) => {
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
   * POST /api/v1/reader/ink-splatter/evaluate
   */
  fastify.post<{
    Body: {
      originX: number;
      originY: number;
      angleRad?: number;
      strokeVelocity?: number;
      profile?: {
        strokeVelocity?: number;
        bleedRadiusPx?: number;
        splatterDensity?: number;
        wickingRate?: number;
        isEnabled?: boolean;
      };
    };
  }>('/api/v1/reader/ink-splatter/evaluate', async (request, reply) => {
    const { originX = 0, originY = 0, angleRad = 0, strokeVelocity = 250.0, profile } = request.body || {};

    const result = service.evaluateSplatter(originX, originY, angleRad, strokeVelocity, profile as any);

    return reply.status(200).send({
      success: true,
      result,
    });
  });
};
