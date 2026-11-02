/**
 * KuraScroll CJK Furigana & Manga Lore Lexicon Fastify Routes
 * Sprint 62 - Zero-Latency Japanese Kanji Furigana & Manhwa Lore Terminology Endpoints
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  FuriganaLexiconService,
  LexiconCategory,
  LexiconEntryInput,
} from '../services/furigana-lexicon-service.js';

export interface FuriganaLexiconRoutesOptions {
  db: DatabaseInstance;
  lexiconService?: FuriganaLexiconService;
}

export const furiganaLexiconRoutes: FastifyPluginAsync<FuriganaLexiconRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: FuriganaLexiconRoutesOptions
) => {
  const service = opts.lexiconService ?? new FuriganaLexiconService(opts.db);

  /**
   * GET /api/v1/lexicon/lookup
   * Fast point lookup for Kanji furigana or manhwa lore definition
   */
  fastify.get<{
    Querystring: {
      term?: string;
      seriesId?: string;
    };
  }>('/api/v1/lexicon/lookup', async (request, reply) => {
    const { term, seriesId } = request.query;

    if (!term || !term.trim()) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Query parameter "term" is required and cannot be empty',
      });
    }

    const entry = service.getEntry(term, seriesId);

    if (!entry) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: `Term "${term}" not found in CJK lexicon`,
      });
    }

    return reply.status(200).send({
      success: true,
      entry,
    });
  });

  /**
   * GET /api/v1/lexicon/search
   * Fuzzy / substring search across term, reading or romaji
   */
  fastify.get<{
    Querystring: {
      q?: string;
      limit?: string | number;
    };
  }>('/api/v1/lexicon/search', async (request, reply) => {
    const { q, limit } = request.query;

    if (!q || !q.trim()) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Query parameter "q" is required and cannot be empty',
      });
    }

    const limitNum =
      limit !== undefined
        ? typeof limit === 'string'
          ? parseInt(limit, 10)
          : limit
        : 10;

    const entries = service.searchEntries(q, limitNum);

    return reply.status(200).send({
      success: true,
      count: entries.length,
      entries,
    });
  });

  /**
   * POST /api/v1/lexicon/entry
   * Upsert a custom lore entry or vocabulary item
   */
  fastify.post<{
    Body: {
      term: string;
      reading: string;
      romaji: string;
      category: LexiconCategory;
      definitionEs: string;
      definitionEn?: string;
      seriesId?: string;
    };
  }>('/api/v1/lexicon/entry', async (request, reply) => {
    const { term, reading, romaji, category, definitionEs, definitionEn, seriesId } = request.body;

    if (!term || !term.trim()) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Field "term" is required',
      });
    }

    if (!reading || !reading.trim()) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Field "reading" is required',
      });
    }

    if (!romaji || !romaji.trim()) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Field "romaji" is required',
      });
    }

    if (!category || !['KANJI', 'VOCAB', 'SERIES_LORE', 'NAME', 'SFX'].includes(category)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Field "category" must be one of: KANJI, VOCAB, SERIES_LORE, NAME, SFX',
      });
    }

    if (!definitionEs || !definitionEs.trim()) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Field "definitionEs" is required',
      });
    }

    const entry = service.upsertEntry({
      term,
      reading,
      romaji,
      category,
      definitionEs,
      definitionEn,
      seriesId,
    });

    return reply.status(201).send({
      success: true,
      entry,
    });
  });

  /**
   * GET /api/v1/lexicon/stats
   * Diagnostics: LRU cache efficiency, hit ratio, total indexed vocabulary
   */
  fastify.get('/api/v1/lexicon/stats', async () => {
    const stats = service.getStats();
    return {
      success: true,
      stats,
    };
  });
};
