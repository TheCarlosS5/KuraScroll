import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import {
  createDatabase,
  runMigrations,
  DatabaseInstance,
} from '../../../../src/backend/db/database.js';
import { spineDewarpRoutes } from '../../../../src/backend/routes/spine-dewarp-routes.js';
import { SpineDewarpService } from '../../../../src/backend/services/spine-dewarp-service.js';

describe('spineDewarpRoutes Fastify Endpoints (Sprint 74)', () => {
  let app: FastifyInstance;
  let db: DatabaseInstance;
  let service: SpineDewarpService;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    runMigrations(db);

    service = new SpineDewarpService(db);

    app = Fastify();
    await app.register(spineDewarpRoutes, { db, spineDewarpService: service });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  describe('GET /api/v1/dewarp/profile/:seriesId', () => {
    it('returns default profile with valid ETag caching', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/dewarp/profile/series_tankobon_route',
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.profile.seriesId).toBe('series_tankobon_route');
      expect(data.profile.curvatureDepth).toBe(0.25);

      const etag = res.headers['etag'];
      expect(etag).toBeDefined();

      const secondRes = await app.inject({
        method: 'GET',
        url: '/api/v1/dewarp/profile/series_tankobon_route',
        headers: {
          'if-none-match': etag as string,
        },
      });
      expect(secondRes.statusCode).toBe(304);
    });

    it('returns 400 when seriesId is whitespace', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/dewarp/profile/%20',
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /api/v1/dewarp/profile', () => {
    it('saves a dewarping profile successfully', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/dewarp/profile',
        payload: {
          seriesId: 'series_monster',
          chapterId: 'ch1',
          pageNumber: 5,
          gutterSide: 'left',
          curvatureDepth: 0.35,
          spineWidthPct: 0.22,
          shadowCompensation: 0.18,
          isEnabled: true,
        },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.profile.seriesId).toBe('series_monster');
      expect(data.profile.curvatureDepth).toBe(0.35);
    });

    it('returns 400 when required fields are missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/dewarp/profile',
        payload: {
          // seriesId missing
          curvatureDepth: 0.35,
        },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('DELETE /api/v1/dewarp/profile/:id', () => {
    it('deletes an existing dewarp profile', async () => {
      // First save
      const saveRes = await app.inject({
        method: 'POST',
        url: '/api/v1/dewarp/profile',
        payload: {
          id: 'custom_prof_id',
          seriesId: 'series_jojo_del',
          gutterSide: 'auto',
          curvatureDepth: 0.30,
          spineWidthPct: 0.20,
          shadowCompensation: 0.15,
          isEnabled: true,
        },
      });
      expect(saveRes.statusCode).toBe(200);

      const delRes = await app.inject({
        method: 'DELETE',
        url: '/api/v1/dewarp/profile/custom_prof_id',
      });

      expect(delRes.statusCode).toBe(200);
      expect(delRes.json().success).toBe(true);
    });
  });

  describe('POST /api/v1/dewarp/calculate-mesh', () => {
    it('calculates 16 slice dewarping mesh via API', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/dewarp/calculate-mesh',
        payload: {
          gutterSide: 'right',
          curvatureDepth: 0.30,
          spineWidthPct: 0.25,
          shadowCompensation: 0.20,
          isEnabled: true,
        },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.slices).toHaveLength(16);
      expect(data.slices[0].scaleX).toBeGreaterThan(1.0);
    });
  });
});
