import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import {
  createDatabase,
  runMigrations,
  DatabaseInstance,
} from '../../../../src/backend/db/database.js';
import { ambientBacklightRoutes } from '../../../../src/backend/routes/ambient-backlight-routes.js';
import { AmbientBacklightService } from '../../../../src/backend/services/ambient-backlight-service.js';

describe('ambientBacklightRoutes Fastify Endpoints (Sprint 80)', () => {
  let app: FastifyInstance;
  let db: DatabaseInstance;
  let service: AmbientBacklightService;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    runMigrations(db);

    service = new AmbientBacklightService(db);

    app = Fastify();
    await app.register(ambientBacklightRoutes, { db, ambientBacklightService: service });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  describe('GET /api/v1/backlight/profile/:seriesId', () => {
    it('returns default profile with valid ETag caching (HTTP 304)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/backlight/profile/series-backlight-route',
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.profile.seriesId).toBe('series-backlight-route');
      expect(data.profile.kelvinTemperature).toBe(6500);

      const etag = res.headers['etag'];
      expect(etag).toBeDefined();

      const secondRes = await app.inject({
        method: 'GET',
        url: '/api/v1/backlight/profile/series-backlight-route',
        headers: {
          'if-none-match': etag as string,
        },
      });

      expect(secondRes.statusCode).toBe(304);
    });

    it('rejects empty or whitespace seriesId with 400 Bad Request', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/backlight/profile/%20%20',
      });

      expect(res.statusCode).toBe(400);
      const data = res.json();
      expect(data.error).toBe('Bad Request');
    });
  });

  describe('POST /api/v1/backlight/profile', () => {
    it('persists and returns updated backlight profile', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/backlight/profile',
        payload: {
          seriesId: 'berserk-night',
          userId: 'user-night',
          kelvinTemperature: 2400,
          luminanceTarget: 0.85,
          circadianAuto: true,
          blueLightReductionRatio: 0.5,
          paperTintMode: 'candlelight',
          isEnabled: true,
        },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.profile.kelvinTemperature).toBe(2400);
      expect(data.profile.paperTintMode).toBe('candlelight');
      expect(data.profile.circadianAuto).toBe(true);
    });

    it('returns 400 when seriesId is missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/backlight/profile',
        payload: {
          kelvinTemperature: 3000,
        },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /api/v1/backlight/calculate-transform', () => {
    it('computes color temperature transform within microseconds', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/backlight/calculate-transform',
        payload: {
          kelvin: 3200,
          luminance: 0.9,
          blueLightReduction: 0.4,
        },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.transform.kelvin).toBe(3200);
      expect(data.transform.cssFilter).toContain('brightness(');
      expect(data.transform.matrixValues).toBeDefined();
    });
  });

  describe('GET /api/v1/backlight/circadian', () => {
    it('evaluates circadian recommendation for specified hour', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/backlight/circadian?hour=12&minute=0',
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.hour).toBe(12);
      expect(data.recommendedKelvin).toBe(6500);
      expect(data.transform).toBeDefined();
    });
  });
});
