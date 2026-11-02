import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../../src/backend/db/database.js';
import { furiganaLexiconRoutes } from '../../../../src/backend/routes/furigana-lexicon-routes.js';
import { FuriganaLexiconService } from '../../../../src/backend/services/furigana-lexicon-service.js';

describe('furiganaLexiconRoutes Fastify Endpoints (Sprint 62)', () => {
  let app: FastifyInstance;
  let db: DatabaseInstance;
  let service: FuriganaLexiconService;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    runMigrations(db);

    db.prepare(`
      INSERT INTO series (id, slug, title_primary, type, status)
      VALUES ('ser-route', 'route-series', 'Route Series', 'manga', 'ongoing')
    `).run();

    service = new FuriganaLexiconService(db);

    app = Fastify();
    await app.register(furiganaLexiconRoutes, { db, lexiconService: service });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  describe('GET /api/v1/lexicon/lookup', () => {
    it('returns 400 when term is missing or blank', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/lexicon/lookup?term=',
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().message).toContain('term');
    });

    it('returns 404 when term does not exist', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/lexicon/lookup?term=UNKNOWN_TERM_XYZ',
      });
      expect(res.statusCode).toBe(404);
    });

    it('returns 200 with entry for seeded iconic term', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/lexicon/lookup?term=卍解',
      });
      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.entry.term).toBe('卍解');
      expect(data.entry.reading).toBe('ばんかい');
      expect(data.entry.romaji).toBe('bankai');
    });
  });

  describe('GET /api/v1/lexicon/search', () => {
    it('returns 400 when q is missing or blank', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/lexicon/search?q=',
      });
      expect(res.statusCode).toBe(400);
    });

    it('returns 200 with matching entries', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/lexicon/search?q=bankai',
      });
      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.count).toBeGreaterThanOrEqual(1);
      expect(data.entries[0].term).toBe('卍解');
    });
  });

  describe('POST /api/v1/lexicon/entry', () => {
    it('returns 400 when category is invalid', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/lexicon/entry',
        payload: {
          term: 'テスト',
          reading: 'てすと',
          romaji: 'tesuto',
          category: 'INVALID_CATEGORY',
          definitionEs: 'Definicion de prueba',
        },
      });
      expect(res.statusCode).toBe(400);
    });

    it('creates new entry successfully', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/lexicon/entry',
        payload: {
          term: '影分身',
          reading: 'かげぶんしん',
          romaji: 'kage bunshin',
          category: 'SERIES_LORE',
          definitionEs: 'Clones de sombra corpóreos que dividen el chakra del usuario equitativamente.',
        },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().success).toBe(true);
      expect(res.json().entry.term).toBe('影分身');
    });
  });

  describe('GET /api/v1/lexicon/stats', () => {
    it('returns cache and database diagnostics', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/lexicon/stats',
      });
      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.stats).toHaveProperty('cachedEntries');
      expect(data.stats).toHaveProperty('totalEntries');
      expect(data.stats).toHaveProperty('hitRatio');
    });
  });
});
