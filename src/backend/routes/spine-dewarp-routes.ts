/**
 * KuraScroll Smart Page Curvature & Spine Flattening Dewarping Fastify Routes
 * Sprint 74 - Polynomial Spine Gutter Dewarping & Shadow Compensation
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  SpineDewarpService,
  SpineDewarpProfile,
  CalculateDewarpMeshOptions,
} from '../services/spine-dewarp-service.js';
import crypto from 'node:crypto';

export interface SpineDewarpRoutesOptions {
  db: DatabaseInstance;
  spineDewarpService?: SpineDewarpService;
}

export const spineDewarpRoutes: FastifyPluginAsync<SpineDewarpRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: SpineDewarpRoutesOptions
) => {
  const service = opts.spineDewarpService ?? new SpineDewarpService(opts.db);

  /**
   * GET /api/v1/dewarp/profile/:seriesId
   * Retrieves active dewarping profile for a series, chapter, or page
   */
  fastify.get<{
    Params: { seriesId: string };
    Querystring: { chapterId?: string; pageNumber?: string };
  }>('/api/v1/dewarp/profile/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;
    const { chapterId, pageNumber } = request.query;

    if (!seriesId || seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid seriesId parameter',
      });
    }

    const pNum = pageNumber ? parseInt(pageNumber, 10) : undefined;
    const profile = service.getProfile(seriesId, chapterId, isNaN(pNum as any) ? undefined : pNum);
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
   * POST /api/v1/dewarp/profile
   * Saves or updates a dewarping profile
   */
  fastify.post<{
    Body: SpineDewarpProfile;
  }>('/api/v1/dewarp/profile', async (request, reply) => {
    const body = request.body;

    if (!body || !body.seriesId || typeof body.curvatureDepth !== 'number') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid request body. Required: seriesId, curvatureDepth',
      });
    }

    const saved = service.saveProfile(body);
    return reply.status(200).send({
      success: true,
      profile: saved,
    });
  });

  /**
   * DELETE /api/v1/dewarp/profile/:id
   * Deletes a dewarping profile by ID
   */
  fastify.delete<{
    Params: { id: string };
  }>('/api/v1/dewarp/profile/:id', async (request, reply) => {
    const { id } = request.params;
    const deleted = service.deleteProfile(id);

    return reply.status(200).send({
      success: deleted,
      message: deleted ? `Profile '${id}' deleted` : `Profile '${id}' not found`,
    });
  });

  /**
   * POST /api/v1/dewarp/calculate-mesh
   * Zero-allocation slice mesh geometry calculation endpoint (SLA 38)
   */
  fastify.post<{
    Body: CalculateDewarpMeshOptions;
  }>('/api/v1/dewarp/calculate-mesh', async (request, reply) => {
    const body = request.body || {};
    const result = SpineDewarpService.calculateDewarpMesh(body);

    return reply.status(200).send({
      success: true,
      ...result,
    });
  });
};
