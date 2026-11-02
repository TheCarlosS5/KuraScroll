import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import {
  createDatabase,
  runMigrations,
  DatabaseInstance,
} from '../../../../src/backend/db/database.js';
import { readingRulerRoutes } from '../../../../src/backend/routes/reading-ruler-routes.js';
import { ReadingRulerService } from '../../../../src/backend/services/reading-ruler-service.js';

describe('readingRulerRoutes Fastify Endpoints (Sprint 71)', () => {
  let app: FastifyInstance;
  let db: DatabaseInstance;
  let service: ReadingRulerService;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    runMigrations(db);

    service = new ReadingRulerService(db);

    app = Fastify();
    await app.register(readingRulerRoutes, { db, readingRulerService: service });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  describe('GET /api/v1/ruler/preferences/:userId', () => {
    it('returns default preferences for user with ETag caching', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/ruler/preferences/user_101',
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.preferences.userId).toBe('user_101');
      expect(data.preferences.mode).toBe('ruler');

      const etag = res.headers['etag'];
      expect(etag).toBeDefined();

      const secondRes = await app.inject({
        method: 'GET',
        url: '/api/v1/ruler/preferences/user_101',
        headers: {
          'if-none-match': etag as string,
        },
      });

      expect(secondRes.statusCode).toBe(304);
    });
  });

  describe('POST /api/v1/ruler/preferences', () => {
    it('returns 400 when body or userId is missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/ruler/preferences',
        payload: {},
      });

      expect(res.statusCode).toBe(400);
      const data = res.json();
      expect(data.error).toBe('Bad Request');
    });

    it('saves preferences successfully', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/ruler/preferences',
        payload: {
          userId: 'user_adhd',
          isEnabled: true,
          mode: 'shutter',
          orientation: 'horizontal',
          slotHeightPx: 80,
          dimOpacity: 0.65,
          tintColor: 'rose',
          pacerSpeedWpm: 280,
        },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.preferences.isEnabled).toBe(true);
      expect(data.preferences.tintColor).toBe('rose');
    });
  });

  describe('POST /api/v1/ruler/calculate-aperture', () => {
    it('returns 400 when required fields are missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/ruler/calculate-aperture',
        payload: { centerCoord: 100 }, // missing viewportLimit
      });

      expect(res.statusCode).toBe(400);
      const data = res.json();
      expect(data.error).toBe('Bad Request');
    });

    it('calculates aperture geometry and returns CSS variables', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/ruler/calculate-aperture',
        payload: {
          centerCoord: 400,
          slotSize: 80,
          viewportLimit: 1080,
          orientation: 'horizontal',
          dimOpacity: 0.50,
          tintColor: 'mint',
        },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.geometry.apertureStart).toBe(360);
      expect(data.geometry.apertureEnd).toBe(440);
      expect(data.geometry.cssVars['--ruler-tint-color']).toBe('#81c784');
    });
  });

  describe('DELETE /api/v1/ruler/preferences/:userId', () => {
    it('resets user preferences to defaults', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/ruler/preferences/user_to_reset',
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.preferences.isEnabled).toBe(false);
    });
  });
});
