/**
 * Fastify Routes for Sprint 55: High-Precision Panel Crop & Dialogue Bubble OCR
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { PanelDetectionService } from '../services/panel-detection-service.js';
import { ReadingDirection } from '../utils/panel-spatial-index.js';

export const registerPanelRoutes: FastifyPluginAsync<{
  panelService: PanelDetectionService;
}> = async (fastify: FastifyInstance, opts) => {
  const { panelService } = opts;

  // GET /api/v1/chapters/:chapterId/pages/:pageNumber/panels
  fastify.get<{
    Params: { chapterId: string; pageNumber: string };
  }>('/api/v1/chapters/:chapterId/pages/:pageNumber/panels', async (request, reply) => {
    const { chapterId, pageNumber } = request.params;
    const pageNum = parseInt(pageNumber, 10);

    if (isNaN(pageNum) || pageNum < 1) {
      return reply.code(400).send({ error: 'Invalid pageNumber' });
    }

    const panels = panelService.getPanelsForPage(chapterId, pageNum);
    return reply.send({ chapterId, pageNumber: pageNum, panels });
  });

  // POST /api/v1/chapters/:chapterId/pages/:pageNumber/panels
  fastify.post<{
    Params: { chapterId: string; pageNumber: string };
    Body: {
      panels: Array<{ x: number; y: number; w: number; h: number }>;
      direction?: ReadingDirection;
    };
  }>('/api/v1/chapters/:chapterId/pages/:pageNumber/panels', async (request, reply) => {
    const { chapterId, pageNumber } = request.params;
    const pageNum = parseInt(pageNumber, 10);

    if (isNaN(pageNum) || pageNum < 1) {
      return reply.code(400).send({ error: 'Invalid pageNumber' });
    }

    const { panels, direction } = request.body || {};
    if (!Array.isArray(panels)) {
      return reply.code(400).send({ error: 'panels must be an array' });
    }

    const saved = panelService.savePanels(chapterId, pageNum, panels, direction || 'RTL');
    return reply.code(201).send({ chapterId, pageNumber: pageNum, count: saved.length, panels: saved });
  });

  // GET /api/v1/chapters/:chapterId/pages/:pageNumber/ocr-bubbles
  fastify.get<{
    Params: { chapterId: string; pageNumber: string };
  }>('/api/v1/chapters/:chapterId/pages/:pageNumber/ocr-bubbles', async (request, reply) => {
    const { chapterId, pageNumber } = request.params;
    const pageNum = parseInt(pageNumber, 10);

    if (isNaN(pageNum) || pageNum < 1) {
      return reply.code(400).send({ error: 'Invalid pageNumber' });
    }

    const bubbles = panelService.getBubblesForPage(chapterId, pageNum);
    return reply.send({ chapterId, pageNumber: pageNum, bubbles });
  });

  // POST /api/v1/chapters/:chapterId/pages/:pageNumber/ocr-bubbles
  fastify.post<{
    Params: { chapterId: string; pageNumber: string };
    Body: {
      bubbles: Array<{
        x: number;
        y: number;
        w: number;
        h: number;
        text: string;
        language?: string;
        confidence?: number;
        bubbleType?: 'SPEECH' | 'THOUGHT' | 'SCREAM' | 'WHISPER' | 'SFX';
      }>;
    };
  }>('/api/v1/chapters/:chapterId/pages/:pageNumber/ocr-bubbles', async (request, reply) => {
    const { chapterId, pageNumber } = request.params;
    const pageNum = parseInt(pageNumber, 10);

    if (isNaN(pageNum) || pageNum < 1) {
      return reply.code(400).send({ error: 'Invalid pageNumber' });
    }

    const { bubbles } = request.body || {};
    if (!Array.isArray(bubbles)) {
      return reply.code(400).send({ error: 'bubbles must be an array' });
    }

    const saved = panelService.saveBubbles(chapterId, pageNum, bubbles);
    return reply.code(201).send({ chapterId, pageNumber: pageNum, count: saved.length, bubbles: saved });
  });

  // GET /api/v1/search/dialogue?q=query&limit=20
  fastify.get<{
    Querystring: { q?: string; limit?: string };
  }>('/api/v1/search/dialogue', async (request, reply) => {
    const query = request.query.q || '';
    const limit = parseInt(request.query.limit || '20', 10);

    const results = panelService.searchDialogue(query, isNaN(limit) ? 20 : limit);
    return reply.send({ query, count: results.length, results });
  });
};
