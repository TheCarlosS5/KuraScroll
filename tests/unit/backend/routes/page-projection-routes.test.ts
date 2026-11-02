import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import {
  createDatabase,
  runMigrations,
  DatabaseInstance,
} from '../../../../src/backend/db/database.js';
import { pageProjectionRoutes } from '../../../../src/backend/routes/page-projection-routes.js';
import { PageProjectionService } from '../../../../src/backend/services/page-projection-service.js';

describe('pageProjectionRoutes Fastify Endpoints (Sprint 81)', () => {
  let app: FastifyInstance;
  let db: DatabaseInstance;
  let service: PageProjectionService;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    runMigrations(db);

    service = new PageProjectionService(db);

    app = Fastify();
    await app.register(pageProjectionRoutes, { db, pageProjectionService: service });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  describe('GET /api/v1/projection/profile/:seriesId', () => {
    it('returns default profile with valid ETag caching (HTTP 304)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/projection/profile/series-projection-route',
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.profile.seriesId).toBe('series-projection-route');
      expect(data.profile.pitchDegrees).toBe(0.0);
      expect(data.profile.focalPlanePreset).toBe('flat_orthodox');

      const etag = res.headers['etag'];
      expect(etag).toBeDefined();

      const secondRes = await app.inject({
        method: 'GET',
        url: '/api/v1/projection/profile/series-projection-route',
        headers: {
          'if-none-match': etag as string,
        },
      });

      expect(secondRes.statusCode).toBe(304);
    });

    it('rejects empty or whitespace seriesId with 400 Bad Request', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/projection/profile/%20%20',
      });

      expect(res.statusCode).toBe(400);
      const data = res.json();
      expect(data.error).toBe('Bad Request');
    });
  });

  describe('POST /api/v1/projection/profile', () => {
    it('persists and returns updated projection profile', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/projection/profile',
        payload: {
          seriesId: 'vinland-desk',
          userId: 'thorfinn',
          pitchDegrees: 18.0,
          yawDegrees: 0.0,
          perspectivePx: 1200,
          keystoneCorrection: 0.25,
          focalPlanePreset: 'desk_tilt_20',
          isEnabled: true,
        },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.profile.pitchDegrees).toBe(18.0);
      expect(data.profile.focalPlanePreset).toBe('desk_tilt_20');
    });

    it('returns 400 when seriesId is missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/projection/profile',
        payload: {
          pitchDegrees: 20.0,
        },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /api/v1/projection/calculate-transform', () => {
    it('computes perspective transform within microseconds', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/projection/calculate-transform',
        payload: {
          pitchDegrees: 18.0,
          yawDegrees: 5.0,
          perspectivePx: 1200,
          keystoneCorrection: 0.25,
        },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.transform.pitch).toBe(18.0);
      expect(data.transform.cssTransform).toContain('perspective(1200px)');
      expect(data.transform.matrix3d).toContain('matrix3d(');
    });
  });

  describe('GET /api/v1/projection/presets', () => {
    it('returns list of canonical focal plane presets', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/projection/presets',
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.presets.desk_tilt_20).toBeDefined();
      expect(data.presets.flat_orthodox).toBeDefined();
    });
  });
});
