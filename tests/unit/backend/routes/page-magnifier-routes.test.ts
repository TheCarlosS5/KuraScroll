import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import {
  createDatabase,
  runMigrations,
  DatabaseInstance,
} from '../../../../src/backend/db/database.js';
import { pageMagnifierRoutes } from '../../../../src/backend/routes/page-magnifier-routes.js';
import { PageMagnifierService } from '../../../../src/backend/services/page-magnifier-service.js';

describe('pageMagnifierRoutes Fastify Endpoints (Sprint 78)', () => {
  let app: FastifyInstance;
  let db: DatabaseInstance;
  let service: PageMagnifierService;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    runMigrations(db);

    service = new PageMagnifierService(db);

    app = Fastify();
    await app.register(pageMagnifierRoutes, { db, pageMagnifierService: service });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  describe('GET /api/v1/magnifier/profile/:seriesId', () => {
    it('returns default profile with valid ETag caching (HTTP 304)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/magnifier/profile/series_magnifier_route',
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.profile.seriesId).toBe('series_magnifier_route');
      expect(data.profile.shape).toBe('circle');
      expect(data.profile.zoomFactor).toBe(2.0);

      const etag = res.headers['etag'];
      expect(etag).toBeDefined();

      const secondRes = await app.inject({
        method: 'GET',
        url: '/api/v1/magnifier/profile/series_magnifier_route',
        headers: {
          'if-none-match': etag as string,
        },
      });
      expect(secondRes.statusCode).toBe(304);
    });

    it('returns 400 when seriesId is whitespace', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/magnifier/profile/%20',
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /api/v1/magnifier/profile', () => {
    it('creates or updates a magnifier profile and returns 200', async () => {
      const postRes = await app.inject({
        method: 'POST',
        url: '/api/v1/magnifier/profile',
        payload: {
          seriesId: 'series_magnifier_route',
          chapterId: 'chap-2',
          shape: 'rectangle',
          zoomFactor: 3.5,
          lensRadiusPx: 150,
          smoothingFactor: 0.10,
          borderColor: '#10b981',
          isEnabled: true,
        },
      });

      expect(postRes.statusCode).toBe(200);
      const postData = postRes.json();
      expect(postData.success).toBe(true);
      expect(postData.profile.shape).toBe('rectangle');
      expect(postData.profile.zoomFactor).toBe(3.5);

      // Verify retrieval with chapterId
      const getRes = await app.inject({
        method: 'GET',
        url: '/api/v1/magnifier/profile/series_magnifier_route?chapterId=chap-2',
      });
      expect(getRes.statusCode).toBe(200);
      const getData = getRes.json();
      expect(getData.profile.shape).toBe('rectangle');
      expect(getData.profile.zoomFactor).toBe(3.5);
    });

    it('returns 400 when seriesId is missing', async () => {
      const postRes = await app.inject({
        method: 'POST',
        url: '/api/v1/magnifier/profile',
        payload: {
          shape: 'circle',
        },
      });

      expect(postRes.statusCode).toBe(400);
    });
  });

  describe('POST /api/v1/magnifier/calculate-transform', () => {
    it('calculates loupe transform directly from payload', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/magnifier/calculate-transform',
        payload: {
          cursorX: 500,
          cursorY: 700,
          containerWidth: 1000,
          containerHeight: 1400,
          zoomFactor: 2.5,
          lensRadiusPx: 130,
          shape: 'circle',
        },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.result.isVisible).toBe(true);
      expect(data.result.lensWidthPx).toBe(260);
      expect(data.result.bgWidth).toBe(2500);
    });

    it('returns 400 when cursorX or cursorY is missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/magnifier/calculate-transform',
        payload: {
          containerWidth: 1000,
        },
      });

      expect(res.statusCode).toBe(400);
    });
  });
});
