import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import {
  createDatabase,
  runMigrations,
  DatabaseInstance,
} from '../../../../src/backend/db/database.js';
import { pageHalftoneRoutes } from '../../../../src/backend/routes/page-halftone-routes.js';
import { PageHalftoneService } from '../../../../src/backend/services/page-halftone-service.js';

describe('pageHalftoneRoutes Fastify Endpoints (Sprint 77)', () => {
  let app: FastifyInstance;
  let db: DatabaseInstance;
  let service: PageHalftoneService;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    runMigrations(db);

    service = new PageHalftoneService(db);

    app = Fastify();
    await app.register(pageHalftoneRoutes, { db, pageHalftoneService: service });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  describe('GET /api/v1/halftone/profile/:seriesId', () => {
    it('returns default profile with valid ETag caching (HTTP 304)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/halftone/profile/series_halftone_route',
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.profile.seriesId).toBe('series_halftone_route');
      expect(data.profile.presetName).toBe('pristine');

      const etag = res.headers['etag'];
      expect(etag).toBeDefined();

      const secondRes = await app.inject({
        method: 'GET',
        url: '/api/v1/halftone/profile/series_halftone_route',
        headers: {
          'if-none-match': etag as string,
        },
      });
      expect(secondRes.statusCode).toBe(304);
    });

    it('returns 400 when seriesId is whitespace', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/halftone/profile/%20',
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /api/v1/halftone/profile', () => {
    it('creates or updates a halftone profile and returns 200', async () => {
      const postRes = await app.inject({
        method: 'POST',
        url: '/api/v1/halftone/profile',
        payload: {
          seriesId: 'series_halftone_route',
          chapterId: 'chap-1',
          presetName: 'shonen_90s',
          dotPitchLpi: 60,
          dotAngleDeg: 45.0,
          dotIntensity: 0.35,
          paperAgePct: 0.20,
          foxingIntensity: 0.05,
          isEnabled: true,
        },
      });

      expect(postRes.statusCode).toBe(200);
      const postData = postRes.json();
      expect(postData.success).toBe(true);
      expect(postData.profile.presetName).toBe('shonen_90s');
      expect(postData.profile.dotIntensity).toBe(0.35);

      // Verify retrieval with chapterId
      const getRes = await app.inject({
        method: 'GET',
        url: '/api/v1/halftone/profile/series_halftone_route?chapterId=chap-1',
      });
      expect(getRes.statusCode).toBe(200);
      const getData = getRes.json();
      expect(getData.profile.presetName).toBe('shonen_90s');
    });

    it('returns 400 when seriesId is missing', async () => {
      const postRes = await app.inject({
        method: 'POST',
        url: '/api/v1/halftone/profile',
        payload: {
          presetName: 'pulp_press',
        },
      });

      expect(postRes.statusCode).toBe(400);
    });
  });

  describe('POST /api/v1/halftone/calculate-matrix', () => {
    it('calculates halftone matrix directly from payload', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/halftone/calculate-matrix',
        payload: {
          profile: {
            presetName: 'tankobon_retro',
            dotPitchLpi: 85,
            dotAngleDeg: 45.0,
            dotIntensity: 0.45,
            paperAgePct: 0.35,
            isEnabled: true,
          },
        },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.result.isEnabled).toBe(true);
      expect(data.result.dotSpacingPx).toBeGreaterThan(0);
      expect(data.result.colorMatrix).toBeDefined();
    });

    it('calculates halftone matrix using stored seriesId profile', async () => {
      service.upsertProfile({
        seriesId: 'series_stored',
        presetName: 'pulp_press',
        dotPitchLpi: 45,
        dotAngleDeg: 45.0,
        dotIntensity: 0.55,
        paperAgePct: 0.50,
        foxingIntensity: 0.25,
        isEnabled: true,
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/halftone/calculate-matrix',
        payload: {
          seriesId: 'series_stored',
        },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.result.isEnabled).toBe(true);
      expect(data.result.dotSpacingPx).toBe(8.53);
    });
  });
});
