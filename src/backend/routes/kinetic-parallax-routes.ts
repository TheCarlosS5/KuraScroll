/**
 * KuraScroll Kinetic Motion Shutter & Multi-Layer Parallax Fastify Routes
 * Sprint 70 - 2.5D Climax Spread Transitions for Manga & Webtoons
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  KineticParallaxService,
  KineticLayerBox,
  CalculateDriftOptions,
} from '../services/kinetic-parallax-service.js';
import crypto from 'node:crypto';

export interface KineticParallaxRoutesOptions {
  db: DatabaseInstance;
  kineticParallaxService?: KineticParallaxService;
}

export const kineticParallaxRoutes: FastifyPluginAsync<KineticParallaxRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: KineticParallaxRoutesOptions
) => {
  const service = opts.kineticParallaxService ?? new KineticParallaxService(opts.db);

  /**
   * GET /api/v1/kinetic/layers/:chapterId/:pageNumber
   * Retrieves kinetic layers for a given chapter and page (optional query panelIndex)
   */
  fastify.get<{
    Params: { chapterId: string; pageNumber: string };
    Querystring: { panelIndex?: string };
  }>('/api/v1/kinetic/layers/:chapterId/:pageNumber', async (request, reply) => {
    const { chapterId, pageNumber } = request.params;
    const pageNum = parseInt(pageNumber, 10);

    if (isNaN(pageNum) || pageNum < 0) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid pageNumber parameter',
      });
    }

    const panelIndex = request.query.panelIndex !== undefined
      ? parseInt(request.query.panelIndex, 10)
      : undefined;

    const layers = service.getLayers(chapterId, pageNum, isNaN(panelIndex as number) ? undefined : panelIndex);
    const payload = JSON.stringify({ success: true, count: layers.length, layers });
    const etag = `"${crypto.createHash('md5').update(payload).digest('hex')}"`;

    if (request.headers['if-none-match'] === etag) {
      return reply.status(304).send();
    }

    reply.header('Cache-Control', 'private, max-age=300, must-revalidate');
    reply.header('ETag', etag);
    return reply.status(200).type('application/json').send(payload);
  });

  /**
   * POST /api/v1/kinetic/layers/register
   * Persists multi-layer kinetic configuration for a climax panel
   */
  fastify.post<{
    Body: {
      chapterId: string;
      pageNumber: number;
      panelIndex: number;
      layers: Array<Omit<KineticLayerBox, 'id' | 'createdAt'>>;
    };
  }>('/api/v1/kinetic/layers/register', async (request, reply) => {
    const { chapterId, pageNumber, panelIndex, layers } = request.body || {};

    if (!chapterId || typeof pageNumber !== 'number' || typeof panelIndex !== 'number' || !Array.isArray(layers)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid request body. Required: chapterId, pageNumber, panelIndex, layers array',
      });
    }

    try {
      const saved = service.saveLayers(chapterId, pageNumber, panelIndex, layers);
      return reply.status(200).send({
        success: true,
        count: saved.length,
        layers: saved,
      });
    } catch (err: any) {
      request.log.error(err);
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: err.message || 'Failed to save kinetic layers',
      });
    }
  });

  /**
   * POST /api/v1/kinetic/calculate-drift
   * Computes zero-allocation 2.5D layer drift and CSS affine transforms
   */
  fastify.post<{
    Body: {
      layers: KineticLayerBox[];
      options: CalculateDriftOptions;
    };
  }>('/api/v1/kinetic/calculate-drift', async (request, reply) => {
    const { layers, options } = request.body || {};

    if (!Array.isArray(layers) || !options || typeof options.inputX !== 'number' || typeof options.inputY !== 'number') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid request body. Required: layers array, options with inputX and inputY',
      });
    }

    const drifts = service.calculateLayerDrifts(layers, options);
    return reply.status(200).send({
      success: true,
      count: drifts.length,
      drifts,
    });
  });

  /**
   * DELETE /api/v1/kinetic/layers/:chapterId/:pageNumber
   * Deletes all kinetic layers for a given page
   */
  fastify.delete<{
    Params: { chapterId: string; pageNumber: string };
  }>('/api/v1/kinetic/layers/:chapterId/:pageNumber', async (request, reply) => {
    const { chapterId, pageNumber } = request.params;
    const pageNum = parseInt(pageNumber, 10);

    if (isNaN(pageNum) || pageNum < 0) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid pageNumber parameter',
      });
    }

    service.deleteLayers(chapterId, pageNum);
    return reply.status(200).send({
      success: true,
      message: `Kinetic layers deleted for chapter ${chapterId} page ${pageNum}`,
    });
  });
};
