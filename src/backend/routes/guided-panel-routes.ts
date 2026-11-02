/**
 * KuraScroll Smart Guided Panel Pacer & Cinematic Auto-Framing Fastify Routes
 * Sprint 68 - Topological Boustrophedon Pacing Endpoints
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  GuidedPanelService,
  GuidedPanelBox,
  ReadingMode,
  PanelFramingOptions,
} from '../services/guided-panel-service.js';
import crypto from 'node:crypto';

export interface GuidedPanelRoutesOptions {
  db: DatabaseInstance;
  guidedPanelService?: GuidedPanelService;
}

export const guidedPanelRoutes: FastifyPluginAsync<GuidedPanelRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: GuidedPanelRoutesOptions
) => {
  const service = opts.guidedPanelService ?? new GuidedPanelService(opts.db);

  /**
   * GET /api/v1/panels/sequence/:chapterId/:pageNumber
   * Retrieves the ordered panel sequence for a chapter page
   */
  fastify.get<{
    Params: { chapterId: string; pageNumber: string };
  }>('/api/v1/panels/sequence/:chapterId/:pageNumber', async (request, reply) => {
    const { chapterId, pageNumber } = request.params;
    const pageNum = parseInt(pageNumber, 10);

    if (isNaN(pageNum) || pageNum < 0) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid pageNumber parameter',
      });
    }

    const panels = service.getPanelSequence(chapterId, pageNum);
    const payload = JSON.stringify({ success: true, count: panels.length, panels });
    const etag = `"${crypto.createHash('md5').update(payload).digest('hex')}"`;

    if (request.headers['if-none-match'] === etag) {
      return reply.status(304).send();
    }

    reply.header('Cache-Control', 'private, max-age=300, must-revalidate');
    reply.header('ETag', etag);
    return reply.status(200).type('application/json').send(payload);
  });

  /**
   * POST /api/v1/panels/sequence/save
   * Persists ordered panel sequence for a chapter page
   */
  fastify.post<{
    Body: {
      chapterId: string;
      pageNumber: number;
      readingMode?: ReadingMode;
      panels: Array<{
        normX: number;
        normY: number;
        normW: number;
        normH: number;
      }>;
    };
  }>('/api/v1/panels/sequence/save', async (request, reply) => {
    const { chapterId, pageNumber, readingMode = 'manga', panels } = request.body || {};

    if (!chapterId || typeof pageNumber !== 'number' || !Array.isArray(panels)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Missing or invalid chapterId, pageNumber, or panels array',
      });
    }

    const normalizedPanels = panels.map((p) => ({
      chapterId,
      pageNumber,
      normX: p.normX,
      normY: p.normY,
      normW: p.normW,
      normH: p.normH,
      aspectRatio: p.normW / Math.max(0.001, p.normH),
      isSplash: false,
    }));

    const saved = service.savePanelSequence(
      chapterId,
      pageNumber,
      normalizedPanels,
      readingMode
    );

    return reply.status(201).send({
      success: true,
      count: saved.length,
      panels: saved,
    });
  });

  /**
   * POST /api/v1/panels/framing
   * Zero-allocation calculation of camera transform coordinates
   */
  fastify.post<{
    Body: {
      panel: GuidedPanelBox;
      options?: PanelFramingOptions;
    };
  }>('/api/v1/panels/framing', async (request, reply) => {
    const { panel, options } = request.body || {};

    if (!panel || typeof panel.normX !== 'number' || typeof panel.normY !== 'number') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Missing or invalid panel object',
      });
    }

    const framing = service.calculatePanelFraming(panel, options);
    return reply.status(200).send({
      success: true,
      framing,
    });
  });

  /**
   * POST /api/v1/panels/boustrophedon-order
   * Ephemeral in-memory Boustrophedon ordering without database writes
   */
  fastify.post<{
    Body: {
      readingMode?: ReadingMode;
      rowEpsilon?: number;
      panels: Array<{
        chapterId?: string;
        pageNumber?: number;
        normX: number;
        normY: number;
        normW: number;
        normH: number;
      }>;
    };
  }>('/api/v1/panels/boustrophedon-order', async (request, reply) => {
    const { readingMode = 'manga', rowEpsilon = 0.05, panels } = request.body || {};

    if (!Array.isArray(panels)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Expected panels array',
      });
    }

    const input = panels.map((p) => ({
      chapterId: p.chapterId ?? 'temp',
      pageNumber: p.pageNumber ?? 1,
      normX: p.normX,
      normY: p.normY,
      normW: p.normW,
      normH: p.normH,
      aspectRatio: p.normW / Math.max(0.001, p.normH),
      isSplash: false,
    }));

    const sorted = service.boustrophedonSort(input, readingMode, rowEpsilon);
    return reply.status(200).send({
      success: true,
      count: sorted.length,
      panels: sorted,
    });
  });
};
