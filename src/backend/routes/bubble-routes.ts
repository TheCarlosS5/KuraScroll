/**
 * KuraScroll Speech Bubble Multilingual Overlay Fastify Routes
 * Sprint 46 - REST Endpoints for Dialogue Overlays, Furigana & Bulk Manifest Import
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import { SpeechBubbleService, SpeechBubbleInput } from '../services/speech-bubble-service.js';

export interface BubbleRoutesOptions {
  db: DatabaseInstance;
  bubbleService?: SpeechBubbleService;
}

export const bubbleRoutes: FastifyPluginAsync<BubbleRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: BubbleRoutesOptions
) => {
  const service = opts.bubbleService ?? new SpeechBubbleService(opts.db);

  // Retrieve speech bubbles for a given chapter page
  fastify.get<{
    Params: { chapterId: string; pageNumber: string };
  }>('/api/v1/chapters/:chapterId/pages/:pageNumber/bubbles', async (request, reply) => {
    const { chapterId, pageNumber } = request.params;
    const pageNum = parseInt(pageNumber, 10);

    if (!chapterId || isNaN(pageNum) || pageNum < 1) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid chapterId or pageNumber'
      });
    }

    const result = service.getPageBubbles(chapterId, pageNum);
    return reply.send(result);
  });

  // Upsert or replace speech bubbles for a given chapter page
  fastify.post<{
    Params: { chapterId: string; pageNumber: string };
    Body: { bubbles: SpeechBubbleInput[] };
  }>('/api/v1/chapters/:chapterId/pages/:pageNumber/bubbles', async (request, reply) => {
    const { chapterId, pageNumber } = request.params;
    const pageNum = parseInt(pageNumber, 10);
    const bubbles = request.body?.bubbles;

    if (!chapterId || isNaN(pageNum) || pageNum < 1 || !Array.isArray(bubbles)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid chapterId, pageNumber or bubbles payload'
      });
    }

    const count = service.upsertPageBubbles(chapterId, pageNum, bubbles);
    return reply.send({
      success: true,
      chapterId,
      pageNumber: pageNum,
      bubblesCount: count
    });
  });

  // Bulk import ComicText or community transcript manifest
  fastify.post<{
    Params: { chapterId: string };
    Body: {
      pages: Array<{ pageNumber: number; bubbles: SpeechBubbleInput[] }>;
    };
  }>('/api/v1/chapters/:chapterId/bubbles/import', async (request, reply) => {
    const { chapterId } = request.params;
    const pages = request.body?.pages;

    if (!chapterId || !Array.isArray(pages)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid chapterId or pages array'
      });
    }

    const result = service.importComicTextManifest({ chapterId, pages });
    return reply.send({
      success: true,
      chapterId,
      pagesImported: result.pagesImported,
      bubblesImported: result.bubblesImported
    });
  });

  // Retrieve chapter bubble summary
  fastify.get<{
    Params: { chapterId: string };
  }>('/api/v1/chapters/:chapterId/bubbles/summary', async (request, reply) => {
    const { chapterId } = request.params;
    if (!chapterId) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Missing chapterId parameter'
      });
    }

    const summary = service.getChapterBubblesSummary(chapterId);
    return reply.send({
      success: true,
      ...summary
    });
  });
};
