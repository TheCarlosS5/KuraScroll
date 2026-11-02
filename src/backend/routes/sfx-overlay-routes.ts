/**
 * KuraScroll Dynamic SFX & Onomatopoeia Overlay Fastify Routes
 * Sprint 67 - Non-Destructive Translation Layer Endpoints
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  SfxOverlayService,
  AddSfxAnnotationInput,
} from '../services/sfx-overlay-service.js';
import crypto from 'node:crypto';

export interface SfxOverlayRoutesOptions {
  db: DatabaseInstance;
  sfxService?: SfxOverlayService;
}

export const sfxOverlayRoutes: FastifyPluginAsync<SfxOverlayRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: SfxOverlayRoutesOptions
) => {
  const service = opts.sfxService ?? new SfxOverlayService(opts.db);

  /**
   * GET /api/v1/sfx/page/:chapterId/:pageNumber
   * Retrieves all SFX annotations for a page with contextual translations
   */
  fastify.get<{
    Params: { chapterId: string; pageNumber: string };
    Querystring: { target?: 'es' | 'en' };
  }>('/api/v1/sfx/page/:chapterId/:pageNumber', async (request, reply) => {
    const { chapterId, pageNumber } = request.params;
    const pageNum = parseInt(pageNumber, 10);
    const target = request.query.target === 'en' ? 'en' : 'es';

    if (isNaN(pageNum) || pageNum < 0) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid pageNumber parameter',
      });
    }

    const annotations = service.getPageAnnotations(chapterId, pageNum, target);
    const payload = JSON.stringify({ success: true, count: annotations.length, annotations });
    const etag = `"${crypto.createHash('md5').update(payload).digest('hex')}"`;

    if (request.headers['if-none-match'] === etag) {
      return reply.status(304).send();
    }

    reply.header('Cache-Control', 'private, max-age=300, must-revalidate');
    reply.header('ETag', etag);
    return reply.status(200).type('application/json').send(payload);
  });

  /**
   * POST /api/v1/sfx/point-hit
   * Ultra-fast spatial hit-testing for reader click/touch point
   */
  fastify.post<{
    Body: {
      chapterId: string;
      pageNumber: number;
      normX: number;
      normY: number;
      target?: 'es' | 'en';
    };
  }>('/api/v1/sfx/point-hit', async (request, reply) => {
    const { chapterId, pageNumber, normX, normY, target } = request.body ?? {};

    if (!chapterId || pageNumber === undefined || normX === undefined || normY === undefined) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'chapterId, pageNumber, normX, and normY are required',
      });
    }

    const hit = service.findSfxAtPoint(
      chapterId,
      pageNumber,
      normX,
      normY,
      target === 'en' ? 'en' : 'es'
    );

    return reply.status(200).send({
      success: true,
      hasHit: Boolean(hit),
      hit,
    });
  });

  /**
   * POST /api/v1/sfx/annotate
   * Adds an SFX bounding box annotation to a page
   */
  fastify.post<{
    Body: AddSfxAnnotationInput;
  }>('/api/v1/sfx/annotate', async (request, reply) => {
    const { chapterId, pageNumber, sfxId, normX, normY, normW, normH } = request.body ?? {};

    if (!chapterId || pageNumber === undefined || !sfxId || normX === undefined || normY === undefined || !normW || !normH) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Valid chapterId, pageNumber, sfxId, and [normX, normY, normW, normH] bounds required',
      });
    }

    const annotation = service.addAnnotation(request.body);

    return reply.status(201).send({
      success: true,
      annotation,
    });
  });

  /**
   * GET /api/v1/sfx/lookup
   * Instant dictionary lookup for kana, romaji, or hangul
   */
  fastify.get<{
    Querystring: { q?: string };
  }>('/api/v1/sfx/lookup', async (request, reply) => {
    const query = request.query.q ?? '';
    const results = service.lookupCatalog(query);

    return reply.status(200).send({
      success: true,
      query,
      count: results.length,
      results,
    });
  });
};
