import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import {
  createDatabase,
  runMigrations,
  DatabaseInstance,
} from '../../../../src/backend/db/database.js';
import { pageSplitStitchRoutes } from '../../../../src/backend/routes/page-split-stitch-routes.js';
import { PageSplitStitchService } from '../../../../src/backend/services/page-split-stitch-service.js';

describe('pageSplitStitchRoutes Fastify Endpoints (Sprint 76)', () => {
  let app: FastifyInstance;
  let db: DatabaseInstance;
  let service: PageSplitStitchService;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    runMigrations(db);

    service = new PageSplitStitchService(db);

    app = Fastify();
    await app.register(pageSplitStitchRoutes, { db, pageSplitStitchService: service });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  describe('GET /api/v1/split-stitch/profile/:seriesId', () => {
    it('returns default profile with valid ETag caching (HTTP 304)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/split-stitch/profile/series_split_route',
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.profile.seriesId).toBe('series_split_route');
      expect(data.profile.mode).toBe('none');

      const etag = res.headers['etag'];
      expect(etag).toBeDefined();

      const secondRes = await app.inject({
        method: 'GET',
        url: '/api/v1/split-stitch/profile/series_split_route',
        headers: {
          'if-none-match': etag as string,
        },
      });
      expect(secondRes.statusCode).toBe(304);
    });

    it('returns 400 when seriesId is whitespace', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/split-stitch/profile/%20',
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /api/v1/split-stitch/profile', () => {
    it('creates or updates a split-stitch profile and returns 200', async () => {
      const postRes = await app.inject({
        method: 'POST',
        url: '/api/v1/split-stitch/profile',
        payload: {
          seriesId: 'berserk-spreads',
          mode: 'split_rtl',
          splitRatio: 0.52,
          stitchGapPx: 0,
          isEnabled: true,
        },
      });

      expect(postRes.statusCode).toBe(200);
      const data = postRes.json();
      expect(data.success).toBe(true);
      expect(data.profile.seriesId).toBe('berserk-spreads');
      expect(data.profile.mode).toBe('split_rtl');
      expect(data.profile.splitRatio).toBe(0.52);

      // Verify retrieval
      const getRes = await app.inject({
        method: 'GET',
        url: '/api/v1/split-stitch/profile/berserk-spreads',
      });
      expect(getRes.statusCode).toBe(200);
      expect(getRes.json().profile.mode).toBe('split_rtl');
    });

    it('returns 400 when seriesId is missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/split-stitch/profile',
        payload: {
          mode: 'split_rtl',
        },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /api/v1/split-stitch/resolve-stream', () => {
    it('resolves virtual stream for mixed single and double pages', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/split-stitch/resolve-stream',
        payload: {
          pages: [
            { pageNumber: 1, width: 800, height: 1200, aspectRatio: 0.667 },
            { pageNumber: 2, width: 1600, height: 1200, aspectRatio: 1.333 },
          ],
          profile: {
            mode: 'split_rtl',
            splitRatio: 0.50,
            isEnabled: true,
          },
        },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.result.totalVirtualPages).toBe(3);
      expect(data.result.slices[1].half).toBe('right');
      expect(data.result.slices[2].half).toBe('left');
    });

    it('returns 400 when pages is not an array', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/split-stitch/resolve-stream',
        payload: {
          pages: 'invalid',
        },
      });
      expect(res.statusCode).toBe(400);
    });
  });
});
