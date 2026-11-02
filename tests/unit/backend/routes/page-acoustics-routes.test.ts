import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import {
  createDatabase,
  runMigrations,
  DatabaseInstance,
} from '../../../../src/backend/db/database.js';
import { pageAcousticsRoutes } from '../../../../src/backend/routes/page-acoustics-routes.js';
import { PageAcousticsService } from '../../../../src/backend/services/page-acoustics-service.js';

describe('pageAcousticsRoutes Fastify Endpoints (Sprint 82)', () => {
  let app: FastifyInstance;
  let db: DatabaseInstance;
  let service: PageAcousticsService;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    runMigrations(db);

    service = new PageAcousticsService(db);

    app = Fastify();
    await app.register(pageAcousticsRoutes, { db, pageAcousticsService: service });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  describe('GET /api/v1/acoustics/profile/:seriesId', () => {
    it('returns default profile with valid ETag caching (HTTP 304)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/acoustics/profile/series-acoustics-route',
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.profile.seriesId).toBe('series-acoustics-route');
      expect(data.profile.paperSubstrate).toBe('tankobon');
      expect(data.profile.volumeLevel).toBe(0.65);

      const etag = res.headers['etag'];
      expect(etag).toBeDefined();

      const secondRes = await app.inject({
        method: 'GET',
        url: '/api/v1/acoustics/profile/series-acoustics-route',
        headers: {
          'if-none-match': etag as string,
        },
      });

      expect(secondRes.statusCode).toBe(304);
    });

    it('rejects empty or whitespace seriesId with 400 Bad Request', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/acoustics/profile/%20%20',
      });

      expect(res.statusCode).toBe(400);
      const data = res.json();
      expect(data.error).toBe('Bad Request');
    });
  });

  describe('POST /api/v1/acoustics/profile', () => {
    it('persists and returns updated acoustics profile', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/acoustics/profile',
        payload: {
          seriesId: 'haikyuu-vol',
          userId: 'hinata',
          paperSubstrate: 'glossy',
          volumeLevel: 0.8,
          stereoPanningEnabled: true,
          hapticPulseEnabled: true,
          hapticIntensity: 0.6,
          isEnabled: true,
        },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.profile.paperSubstrate).toBe('glossy');
      expect(data.profile.volumeLevel).toBe(0.8);
    });

    it('returns 400 when seriesId is missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/acoustics/profile',
        payload: {
          volumeLevel: 0.5,
        },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /api/v1/acoustics/calculate-params', () => {
    it('computes acoustic synthesis parameters within microseconds', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/acoustics/calculate-params',
        payload: {
          pageDirection: 'next',
          readingDirection: 'rtl',
          substrate: 'tankobon',
          volume: 0.75,
          stereoEnabled: true,
        },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.params.panStart).toBe(0.75);
      expect(data.params.panEnd).toBe(-0.75);
      expect(data.params.cutoffHz).toBe(2800);
    });
  });

  describe('GET /api/v1/acoustics/substrates', () => {
    it('returns list of canonical paper substrate configs', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/acoustics/substrates',
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.substrates.tankobon).toBeDefined();
      expect(data.substrates.newsprint).toBeDefined();
      expect(data.substrates.glossy).toBeDefined();
      expect(data.substrates.silk_ribbon).toBeDefined();
    });
  });
});
