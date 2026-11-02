/**
 * KuraScroll Intelligent Dual-Page Splitter & Webtoon Vertical Stitcher Fastify Routes
 * Sprint 76 - Smart Page Auto-Slicer & Continuous Strip Weaver
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  PageSplitStitchService,
  PageSplitStitchProfile,
  SplitStitchMode,
  RawPageInput,
} from '../services/page-split-stitch-service.js';
import crypto from 'node:crypto';

export interface PageSplitStitchRoutesOptions {
  db: DatabaseInstance;
  pageSplitStitchService?: PageSplitStitchService;
}

export const pageSplitStitchRoutes: FastifyPluginAsync<PageSplitStitchRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: PageSplitStitchRoutesOptions
) => {
  const service = opts.pageSplitStitchService ?? new PageSplitStitchService(opts.db);

  /**
   * GET /api/v1/split-stitch/profile/:seriesId
   * Retrieves active split-stitch profile for a series, chapter, or page with ETag caching
   */
  fastify.get<{
    Params: { seriesId: string };
    Querystring: { chapterId?: string; pageNumber?: string };
  }>('/api/v1/split-stitch/profile/:seriesId', async (request, reply) => {
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
   * POST /api/v1/split-stitch/profile
   * Saves or updates a split-stitch profile
   */
  fastify.post<{
    Body: {
      seriesId: string;
      chapterId?: string | null;
      pageNumber?: number | null;
      mode?: SplitStitchMode;
      splitRatio?: number;
      stitchGapPx?: number;
      isEnabled?: boolean;
    };
  }>('/api/v1/split-stitch/profile', async (request, reply) => {
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
      pageNumber: body.pageNumber ?? null,
      mode: body.mode ?? 'none',
      splitRatio: body.splitRatio ?? 0.50,
      stitchGapPx: body.stitchGapPx ?? 0,
      isEnabled: body.isEnabled !== false,
    });

    return reply.status(200).send({ success: true, profile: saved });
  });

  /**
   * POST /api/v1/split-stitch/resolve-stream
   * Fast virtual page stream resolution and coordinate mapping (SLA 40)
   */
  fastify.post<{
    Body: {
      pages: RawPageInput[];
      profile?: Partial<PageSplitStitchProfile>;
      seriesId?: string;
      chapterId?: string;
    };
  }>('/api/v1/split-stitch/resolve-stream', async (request, reply) => {
    const { pages, profile: explicitProfile, seriesId, chapterId } = request.body || {};

    if (!Array.isArray(pages)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'pages array is required',
      });
    }

    const profile = explicitProfile ?? (seriesId ? service.getProfile(seriesId, chapterId) : {});
    const result = PageSplitStitchService.resolveVirtualPageStream(pages, profile);

    return reply.status(200).send({
      success: true,
      result,
    });
  });
};
