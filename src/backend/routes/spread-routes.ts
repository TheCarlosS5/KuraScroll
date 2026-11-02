/**
 * KuraScroll Two-Page Spread & Layout Manifest Routes
 * Sprint 51 - Fastify Endpoints for Virtual Spread Splitting
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import { SpreadSplitterService } from '../services/spread-splitter-service.js';
import { detectSpreadLayout, ReadingDirection } from '../utils/spread-detector.js';

export interface SpreadRoutesOptions {
  db: DatabaseInstance;
  spreadService?: SpreadSplitterService;
}

export const spreadRoutes: FastifyPluginAsync<SpreadRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: SpreadRoutesOptions
) => {
  const service = opts.spreadService ?? new SpreadSplitterService(opts.db);

  /**
   * GET /api/v1/chapters/:chapterId/spread-manifest
   * Retrieves all spread manifests for a chapter.
   */
  fastify.get<{
    Params: { chapterId: string };
  }>('/api/v1/chapters/:chapterId/spread-manifest', async (request, reply) => {
    const { chapterId } = request.params;
    if (!chapterId) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'chapterId is required',
      });
    }

    const manifests = service.getChapterSpreadManifests(chapterId);
    return reply.send({
      success: true,
      chapterId,
      manifests,
      total: manifests.length,
    });
  });

  /**
   * GET /api/v1/chapters/:chapterId/pages/:pageNumber/spread
   * Retrieves spread manifest for a specific page.
   */
  fastify.get<{
    Params: { chapterId: string; pageNumber: string };
  }>('/api/v1/chapters/:chapterId/pages/:pageNumber/spread', async (request, reply) => {
    const { chapterId, pageNumber } = request.params;
    const pageNum = parseInt(pageNumber, 10);

    if (!chapterId || isNaN(pageNum) || pageNum < 1) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Valid chapterId and numeric pageNumber are required',
      });
    }

    const manifest = service.getSpreadManifest(chapterId, pageNum);
    return reply.send({
      success: true,
      chapterId,
      pageNumber: pageNum,
      manifest,
    });
  });

  /**
   * POST /api/v1/chapters/:chapterId/spread-detect
   * Batch detects and upserts spread manifests from page dimensions.
   */
  fastify.post<{
    Params: { chapterId: string };
    Body: {
      pages: Array<{ pageNumber: number; width: number; height: number; isCover?: boolean }>;
      readingDirection?: ReadingDirection;
    };
  }>('/api/v1/chapters/:chapterId/spread-detect', async (request, reply) => {
    const { chapterId } = request.params;
    const { pages, readingDirection = 'rtl' } = request.body || {};

    if (!chapterId || !Array.isArray(pages) || pages.length === 0) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'chapterId and non-empty pages array are required',
      });
    }

    const manifests = service.batchDetectChapter(chapterId, pages, readingDirection);
    return reply.send({
      success: true,
      chapterId,
      manifests,
      totalProcessed: manifests.length,
    });
  });

  /**
   * POST /api/v1/chapters/:chapterId/virtual-pages
   * Expands physical chapter pages into virtual slice sequence.
   */
  fastify.post<{
    Params: { chapterId: string };
    Body: {
      physicalPages: Array<{ pageNumber: number; width?: number; height?: number; url?: string }>;
      readingDirection?: ReadingDirection;
    };
  }>('/api/v1/chapters/:chapterId/virtual-pages', async (request, reply) => {
    const { chapterId } = request.params;
    const { physicalPages, readingDirection = 'rtl' } = request.body || {};

    if (!chapterId || !Array.isArray(physicalPages)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'chapterId and physicalPages array are required',
      });
    }

    const virtualPages = service.buildVirtualPageList(chapterId, physicalPages, readingDirection);
    return reply.send({
      success: true,
      chapterId,
      virtualPages,
      totalVirtual: virtualPages.length,
    });
  });

  /**
   * POST /api/v1/geometry/detect
   * Pure in-memory calculation utility for single spread detection.
   */
  fastify.post<{
    Body: {
      width: number;
      height: number;
      sourcePageNumber?: number;
      readingDirection?: ReadingDirection;
      isCover?: boolean;
      explicitOverride?: 'automatic' | 'force_single' | 'force_split';
      splitPositionPct?: number;
    };
  }>('/api/v1/geometry/detect', async (request, reply) => {
    const body = request.body;
    if (!body || !body.width || !body.height) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'width and height are required',
      });
    }

    try {
      const result = detectSpreadLayout(body);
      return reply.send({
        success: true,
        result,
      });
    } catch (err: any) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: err.message,
      });
    }
  });
};
