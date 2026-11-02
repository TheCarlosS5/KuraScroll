import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import {
  createDatabase,
  runMigrations,
  DatabaseInstance,
} from '../../../../src/backend/db/database.js';
import { guidedPanelRoutes } from '../../../../src/backend/routes/guided-panel-routes.js';
import { GuidedPanelService } from '../../../../src/backend/services/guided-panel-service.js';

describe('guidedPanelRoutes Fastify Endpoints (Sprint 68)', () => {
  let app: FastifyInstance;
  let db: DatabaseInstance;
  let service: GuidedPanelService;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    runMigrations(db);

    service = new GuidedPanelService(db);

    app = Fastify();
    await app.register(guidedPanelRoutes, { db, guidedPanelService: service });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  describe('GET /api/v1/panels/sequence/:chapterId/:pageNumber', () => {
    it('returns 400 when pageNumber is invalid', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/panels/sequence/ch-1/invalid_page',
      });

      expect(res.statusCode).toBe(400);
      const data = res.json();
      expect(data.error).toBe('Bad Request');
    });

    it('returns empty panels array when no panels saved', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/panels/sequence/ch-1/1',
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.count).toBe(0);
      expect(data.panels).toEqual([]);
    });

    it('returns 304 Not Modified when ETag matches', async () => {
      const firstRes = await app.inject({
        method: 'GET',
        url: '/api/v1/panels/sequence/ch-1/1',
      });

      const etag = firstRes.headers.etag as string;
      expect(etag).toBeDefined();

      const cachedRes = await app.inject({
        method: 'GET',
        url: '/api/v1/panels/sequence/ch-1/1',
        headers: {
          'if-none-match': etag,
        },
      });

      expect(cachedRes.statusCode).toBe(304);
    });
  });

  describe('POST /api/v1/panels/sequence/save', () => {
    it('returns 400 when required fields are missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/panels/sequence/save',
        payload: {
          chapterId: 'ch-1',
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('saves ordered panel sequences and returns 201', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/panels/sequence/save',
        payload: {
          chapterId: 'ch-101',
          pageNumber: 3,
          readingMode: 'manga',
          panels: [
            { normX: 0.1, normY: 0.1, normW: 0.35, normH: 0.4 },
            { normX: 0.55, normY: 0.1, normW: 0.35, normH: 0.4 },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.count).toBe(2);
      expect(data.panels[0].normX).toBe(0.55); // Right panel first in Manga RTL
      expect(data.panels[1].normX).toBe(0.1);
    });
  });

  describe('POST /api/v1/panels/framing', () => {
    it('returns 400 when panel is missing or invalid', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/panels/framing',
        payload: {},
      });

      expect(res.statusCode).toBe(400);
    });

    it('calculates camera framing target coordinates with 200 OK', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/panels/framing',
        payload: {
          panel: {
            chapterId: 'ch-1',
            pageNumber: 1,
            panelIndex: 0,
            normX: 0.2,
            normY: 0.2,
            normW: 0.6,
            normH: 0.4,
            aspectRatio: 1.5,
            readingOrderScore: 0,
            isSplash: false,
          },
          options: {
            viewportW: 1920,
            viewportH: 1080,
            padding: 0.05,
          },
        },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.framing).toBeDefined();
      expect(data.framing.scale).toBeGreaterThan(1.0);
      expect(data.framing.normCenter.x).toBeCloseTo(0.5, 2);
      expect(data.framing.normCenter.y).toBeCloseTo(0.4, 2);
    });
  });

  describe('POST /api/v1/panels/boustrophedon-order', () => {
    it('performs in-memory ordering and returns 200', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/panels/boustrophedon-order',
        payload: {
          readingMode: 'comic',
          panels: [
            { normX: 0.6, normY: 0.1, normW: 0.3, normH: 0.4 },
            { normX: 0.1, normY: 0.1, normW: 0.3, normH: 0.4 },
          ],
        },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.count).toBe(2);
      expect(data.panels[0].normX).toBe(0.1); // Left first in Comic LTR
    });
  });
});
