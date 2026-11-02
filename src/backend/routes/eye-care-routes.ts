/**
 * KuraScroll Eye Care & Contrast Adaptive Filter Routes
 * Sprint 50 - Fastify Endpoints for OLED, E-Ink, and Smart Invert Profiles
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import { EyeCareService, EyeCareFilterMode, EyeCarePreferences } from '../services/eye-care-service.js';
import { classifyPageChroma } from '../utils/color-classifier.js';

export interface EyeCareRoutesOptions {
  db: DatabaseInstance;
  eyeCareService?: EyeCareService;
}

export const eyeCareRoutes: FastifyPluginAsync<EyeCareRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: EyeCareRoutesOptions
) => {
  const service = opts.eyeCareService ?? new EyeCareService(opts.db);

  /**
   * GET /api/v1/preferences/eye-care/:userId
   * Retrieves eye care preferences for a user, returning both config and calculated CSS filter.
   */
  fastify.get<{
    Params: {
      userId: string;
    };
  }>('/api/v1/preferences/eye-care/:userId', async (request, reply) => {
    const { userId } = request.params;
    if (!userId) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'userId is required',
      });
    }

    const preferences = service.getPreferences(userId);
    const cssFilter = service.buildCssFilter({
      filterMode: preferences.filterMode,
      brightnessPct: preferences.brightnessPct,
      contrastPct: preferences.contrastPct,
      blueLightReductionPct: preferences.blueLightReductionPct,
      isMonochromePage: true,
    });

    return reply.send({
      success: true,
      preferences,
      cssFilter,
    });
  });

  /**
   * PUT /api/v1/preferences/eye-care/:userId
   * Saves eye care preferences for a user with clamping and validation.
   */
  fastify.put<{
    Params: {
      userId: string;
    };
    Body: Partial<{
      filterMode: EyeCareFilterMode;
      brightnessPct: number;
      contrastPct: number;
      blueLightReductionPct: number;
    }>;
  }>('/api/v1/preferences/eye-care/:userId', async (request, reply) => {
    const { userId } = request.params;
    if (!userId) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'userId is required',
      });
    }

    const body = request.body || {};
    const updated = service.upsertPreferences(userId, body);
    const cssFilter = service.buildCssFilter({
      filterMode: updated.filterMode,
      brightnessPct: updated.brightnessPct,
      contrastPct: updated.contrastPct,
      blueLightReductionPct: updated.blueLightReductionPct,
      isMonochromePage: true,
    });

    return reply.send({
      success: true,
      preferences: updated,
      cssFilter,
    });
  });

  /**
   * POST /api/v1/analysis/classify-page-chroma
   * Fast zero-allocation classification of an 8x8 RGBA sample buffer.
   */
  fastify.post<{
    Body: {
      rgbaBytes?: number[];
      rgbaBase64?: string;
      chromaThreshold?: number;
    };
  }>('/api/v1/analysis/classify-page-chroma', async (request, reply) => {
    const body = request.body;
    let buffer: Uint8Array;

    if (body.rgbaBytes && Array.isArray(body.rgbaBytes)) {
      buffer = new Uint8Array(body.rgbaBytes);
    } else if (body.rgbaBase64 && typeof body.rgbaBase64 === 'string') {
      buffer = Buffer.from(body.rgbaBase64, 'base64');
    } else {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'rgbaBytes array or rgbaBase64 string must be provided',
      });
    }

    const threshold = body.chromaThreshold !== undefined ? Number(body.chromaThreshold) : 14;
    const classification = classifyPageChroma(buffer, threshold);

    return reply.send({
      success: true,
      classification,
    });
  });

  /**
   * POST /api/v1/filters/compute-css
   * Direct CSS filter generator for client reader states.
   */
  fastify.post<{
    Body: {
      filterMode: EyeCareFilterMode;
      isMonochromePage?: boolean;
      brightnessPct?: number;
      contrastPct?: number;
      blueLightReductionPct?: number;
    };
  }>('/api/v1/filters/compute-css', async (request, reply) => {
    const body = request.body;
    if (!body || !body.filterMode) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'filterMode is required',
      });
    }

    const cssFilter = service.buildCssFilter(body);

    return reply.send({
      success: true,
      cssFilter,
    });
  });
};
