/**
 * KuraScroll Saccadic Glance & Panel Magnifier Loupe Fastify Routes
 * Sprint 78 - Optical Loupe & Sub-Panel Zoom Reticle
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  PageMagnifierService,
  PageMagnifierProfile,
  LoupeShape,
  LoupeTransformInput,
} from '../services/page-magnifier-service.js';
import crypto from 'node:crypto';

export interface PageMagnifierRoutesOptions {
  db: DatabaseInstance;
  pageMagnifierService?: PageMagnifierService;
}

export const pageMagnifierRoutes: FastifyPluginAsync<PageMagnifierRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: PageMagnifierRoutesOptions
) => {
  const service = opts.pageMagnifierService ?? new PageMagnifierService(opts.db);

  /**
   * GET /api/v1/magnifier/profile/:seriesId
   * Retrieves active magnifier profile for a series or chapter with ETag caching
   */
  fastify.get<{
    Params: { seriesId: string };
    Querystring: { chapterId?: string };
  }>('/api/v1/magnifier/profile/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;
    const { chapterId } = request.query;

    if (!seriesId || seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid seriesId parameter',
      });
    }

    const profile = service.getProfile(seriesId, chapterId);
    const payload = JSON.stringify({ success: true, profile });
    const etag = `"${crypto.createHash('md5').update(payload).digest('hex')}"`;

    if (request.headers['if-none-match'] === etag) {
      return reply.status(304).send();
    }

    reply.header('Cache-Control', 'private, max-age=60, must-revalidate');
    reply.header('ETag', etag);
    return reply.status(200).type('application/json').send(payload);
  });

  /**
   * POST /api/v1/magnifier/profile
   * Saves or updates a magnifier loupe profile
   */
  fastify.post<{
    Body: {
      seriesId: string;
      chapterId?: string | null;
      shape?: LoupeShape;
      zoomFactor?: number;
      lensRadiusPx?: number;
      smoothingFactor?: number;
      borderColor?: string;
      isEnabled?: boolean;
    };
  }>('/api/v1/magnifier/profile', async (request, reply) => {
    const body = request.body;

    if (!body || !body.seriesId || body.seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'seriesId is required',
      });
    }

    const saved = service.upsertProfile({
      seriesId: body.seriesId,
      chapterId: body.chapterId ?? null,
      shape: body.shape ?? 'circle',
      zoomFactor: body.zoomFactor ?? 2.0,
      lensRadiusPx: body.lensRadiusPx ?? 120,
      smoothingFactor: body.smoothingFactor ?? 0.15,
      borderColor: body.borderColor ?? '#3b82f6',
      isEnabled: body.isEnabled !== false,
    });

    return reply.status(200).send({ success: true, profile: saved });
  });

  /**
   * POST /api/v1/magnifier/calculate-transform
   * Fast loupe transform calculation (SLA 42 < 20µs)
   */
  fastify.post<{
    Body: LoupeTransformInput;
  }>('/api/v1/magnifier/calculate-transform', async (request, reply) => {
    const body = request.body;

    if (!body || typeof body.cursorX !== 'number' || typeof body.cursorY !== 'number') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'cursorX and cursorY are required numbers',
      });
    }

    const result = PageMagnifierService.calculateLoupeTransform(body);

    return reply.status(200).send({
      success: true,
      result,
    });
  });
};
