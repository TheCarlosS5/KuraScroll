import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import {
  createDatabase,
  runMigrations,
  DatabaseInstance,
} from '../../../../src/backend/db/database.js';
import { sfxOverlayRoutes } from '../../../../src/backend/routes/sfx-overlay-routes.js';
import { SfxOverlayService } from '../../../../src/backend/services/sfx-overlay-service.js';

describe('sfxOverlayRoutes Fastify Endpoints (Sprint 67)', () => {
  let app: FastifyInstance;
  let db: DatabaseInstance;
  let service: SfxOverlayService;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    runMigrations(db);

    service = new SfxOverlayService(db);

    app = Fastify();
    await app.register(sfxOverlayRoutes, { db, sfxService: service });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  describe('GET /api/v1/sfx/catalog/lookup', () => {
    it('returns 200 with catalog matches for query', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/sfx/lookup?q=Gogogo',
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.count).toBeGreaterThan(0);
      expect(data.results[0].surface).toBe('ゴゴゴ');
    });

    it('returns empty array when query has no matches', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/sfx/lookup?q=nonexistent',
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.count).toBe(0);
      expect(data.results).toEqual([]);
    });
  });

  describe('POST /api/v1/sfx/annotate & GET /api/v1/sfx/page/:chapterId/:pageNumber', () => {
    it('returns 400 when missing required annotation parameters', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/sfx/annotate',
        payload: { chapterId: 'ch_test' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('creates an annotation and retrieves it via GET page endpoint with ETag', async () => {
      const sfx = service.lookupCatalog('ドドド')[0];

      const resCreate = await app.inject({
        method: 'POST',
        url: '/api/v1/sfx/annotate',
        payload: {
          chapterId: 'ch_jojo_1',
          pageNumber: 5,
          sfxId: sfx.id,
          normX: 0.2,
          normY: 0.3,
          normW: 0.15,
          normH: 0.25,
        },
      });

      expect(resCreate.statusCode).toBe(201);
      const createData = resCreate.json();
      expect(createData.success).toBe(true);
      expect(createData.annotation.normX).toBe(0.2);

      // GET annotations
      const resGet = await app.inject({
        method: 'GET',
        url: '/api/v1/sfx/page/ch_jojo_1/5?target=es',
      });

      expect(resGet.statusCode).toBe(200);
      expect(resGet.headers['etag']).toBeDefined();
      const getData = resGet.json();
      expect(getData.count).toBe(1);
      expect(getData.annotations[0].displayTranslation).toBe('¡PUM PUM PUM!');

      // Verify HTTP 304 Not Modified
      const etag = resGet.headers['etag'] as string;
      const res304 = await app.inject({
        method: 'GET',
        url: '/api/v1/sfx/page/ch_jojo_1/5?target=es',
        headers: { 'if-none-match': etag },
      });
      expect(res304.statusCode).toBe(304);
    });
  });

  describe('POST /api/v1/sfx/point-hit', () => {
    it('returns 400 when coordinates or identifiers are missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/sfx/point-hit',
        payload: {},
      });
      expect(res.statusCode).toBe(400);
    });

    it('returns hit details when touch/cursor coordinates fall inside bounding box', async () => {
      const sfx = service.lookupCatalog('ドン!!')[0];
      service.addAnnotation({
        chapterId: 'ch_onepiece_1',
        pageNumber: 2,
        sfxId: sfx.id,
        normX: 0.4,
        normY: 0.6,
        normW: 0.2,
        normH: 0.2,
      });

      const resHit = await app.inject({
        method: 'POST',
        url: '/api/v1/sfx/point-hit',
        payload: {
          chapterId: 'ch_onepiece_1',
          pageNumber: 2,
          normX: 0.45,
          normY: 0.65,
          target: 'es',
        },
      });

      expect(resHit.statusCode).toBe(200);
      const hitData = resHit.json();
      expect(hitData.hasHit).toBe(true);
      expect(hitData.hit.sfx.romanization).toBe('Don!!');
    });
  });
});
