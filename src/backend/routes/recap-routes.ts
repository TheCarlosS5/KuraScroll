/**
 * KuraScroll Dynamic Story Recap Routes
 * Sprint 48 - Fastify Endpoints for Anti-Spoiler Recaps and Reading Companion
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import { StoryRecapService, StoryRecapInput } from '../services/story-recap-service.js';

export interface RecapRoutesOptions {
  db: DatabaseInstance;
  recapService?: StoryRecapService;
}

export const recapRoutes: FastifyPluginAsync<RecapRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: RecapRoutesOptions
) => {
  const service = opts.recapService ?? new StoryRecapService(opts.db);

  /**
   * Anti-Spoiler Recap Query for reader opening a specific chapter.
   * GET /api/v1/recaps/chapter?seriesId=...&chapterNumber=...&languageTag=es&lastReadAt=...
   */
  fastify.get<{
    Querystring: {
      seriesId: string;
      chapterNumber: string;
      languageTag?: string;
      recapKind?: 'short' | 'standard' | 'deep';
      lastReadAt?: string;
    };
  }>('/api/v1/recaps/chapter', async (request, reply) => {
    const { seriesId, chapterNumber, languageTag = 'es', recapKind = 'standard', lastReadAt } = request.query;

    if (!seriesId || chapterNumber === undefined) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Parameters seriesId and chapterNumber are required',
      });
    }

    const num = parseFloat(chapterNumber);
    if (isNaN(num) || num < 0) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid chapterNumber',
      });
    }

    const recap = service.getRecapForChapter(seriesId, num, languageTag, recapKind);
    const isCatchUpRecommended = service.checkInactivityCatchUp(lastReadAt);

    return reply.send({
      success: true,
      seriesId,
      currentChapterNumber: num,
      recap,
      isCatchUpRecommended,
    });
  });

  /**
   * Chronological recaps list for a series.
   * GET /api/v1/recaps/series/:seriesId?languageTag=es
   */
  fastify.get<{
    Params: {
      seriesId: string;
    };
    Querystring: {
      languageTag?: string;
    };
  }>('/api/v1/recaps/series/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;
    const { languageTag = 'es' } = request.query;

    if (!seriesId) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'seriesId is required',
      });
    }

    const recaps = service.getRecapsForSeries(seriesId, languageTag);
    return reply.send({
      success: true,
      seriesId,
      total: recaps.length,
      recaps,
    });
  });

  /**
   * Administrative Upsert for Story Recaps
   * POST /api/v1/admin/recaps
   */
  fastify.post<{
    Body: StoryRecapInput;
  }>('/api/v1/admin/recaps', async (request, reply) => {
    const body = request.body;
    if (!body || !body.seriesId || typeof body.throughChapterSeq !== 'number' || !body.arcTitle || !body.summaryText) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Missing required recap fields (seriesId, throughChapterSeq, arcTitle, summaryText)',
      });
    }

    try {
      const record = service.upsertRecap(body);
      return reply.status(201).send({
        success: true,
        recap: record,
      });
    } catch (err: any) {
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: err.message || 'Failed to upsert story recap',
      });
    }
  });

  /**
   * Administrative Deletion for Story Recaps
   * DELETE /api/v1/admin/recaps/:id
   */
  fastify.delete<{
    Params: {
      id: string;
    };
  }>('/api/v1/admin/recaps/:id', async (request, reply) => {
    const idNum = parseInt(request.params.id, 10);
    if (isNaN(idNum) || idNum <= 0) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Valid numeric recap id is required',
      });
    }

    const deleted = service.deleteRecap(idNum);
    return reply.send({
      success: true,
      deleted,
    });
  });
};
