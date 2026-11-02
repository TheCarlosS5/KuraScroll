import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../../src/backend/db/database.js';
import { dialogueSearchRoutes } from '../../../../src/backend/routes/dialogue-search-routes.js';
import { DialogueSearchService } from '../../../../src/backend/services/dialogue-search-service.js';

describe('dialogueSearchRoutes Fastify Endpoints (Sprint 60)', () => {
  let app: FastifyInstance;
  let db: DatabaseInstance;
  let service: DialogueSearchService;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    runMigrations(db);

    db.prepare(`
      INSERT INTO series (id, slug, title_primary, type, status)
      VALUES ('ser-route', 'route-manga', 'Route Manga', 'manga', 'ongoing')
    `).run();

    db.prepare(`
      INSERT INTO chapters (id, series_id, chapter_number, title, storage_path, page_count)
      VALUES 
        ('ch-route-1', 'ser-route', 1, 'Ch 1', '/tmp/1.cbz', 20),
        ('ch-route-5', 'ser-route', 5, 'Ch 5', '/tmp/5.cbz', 20)
    `).run();

    service = new DialogueSearchService(db);
    service.indexBatch([
      {
        id: 'bub-r1',
        chapterId: 'ch-route-1',
        pageNumber: 2,
        bubbleIndex: 0,
        x: 10, y: 10, w: 20, h: 20,
        text: 'お前はもう死んでいる…',
      },
      {
        id: 'bub-r5',
        chapterId: 'ch-route-5',
        pageNumber: 10,
        bubbleIndex: 0,
        x: 10, y: 10, w: 20, h: 20,
        text: 'お前はもう死んでいると言ったはずだ！',
      },
    ]);

    app = Fastify();
    await app.register(dialogueSearchRoutes, { db, dialogueService: service });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  describe('GET /api/v1/dialogue/search', () => {
    it('returns 400 if parameter q is missing or blank', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/dialogue/search',
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().message).toContain('"q" is required');

      const resBlank = await app.inject({
        method: 'GET',
        url: '/api/v1/dialogue/search?q=%20%20',
      });
      expect(resBlank.statusCode).toBe(400);
    });

    it('returns 200 with matching dialogue results', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/dialogue/search?q=死んでいる',
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.count).toBe(2);
      expect(json.results.length).toBe(2);
      expect(json.results[0].text).toContain('死んでいる');
      expect(json.queryTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('filters by maxChapter for anti-spoiler protection', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/dialogue/search?q=死んでいる&maxChapter=1',
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.count).toBe(1);
      expect(json.results[0].bubbleId).toBe('bub-r1');
    });
  });

  describe('POST /api/v1/dialogue/index-batch', () => {
    it('returns 400 when payload is missing bubbles array', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/dialogue/index-batch',
        payload: {},
      });
      expect(res.statusCode).toBe(400);
    });

    it('indexes new speech bubbles via batch POST', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/dialogue/index-batch',
        payload: {
          bubbles: [
            {
              id: 'bub-post-1',
              chapterId: 'ch-route-1',
              pageNumber: 3,
              bubbleIndex: 0,
              x: 15, y: 15, w: 20, h: 20,
              text: '何をする気配だ？！',
            },
          ],
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
      expect(res.json().indexedCount).toBe(1);

      expect(service.getTotalCount()).toBe(3);
    });
  });

  describe('POST /api/v1/dialogue/optimize', () => {
    it('returns 200 when optimizing index', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/dialogue/optimize',
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
    });
  });

  describe('GET /api/v1/dialogue/stats', () => {
    it('returns total indexed bubbles count', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/dialogue/stats',
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().totalIndexedBubbles).toBe(2);
    });
  });
});
