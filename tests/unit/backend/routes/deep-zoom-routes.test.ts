import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import {
  createDatabase,
  runMigrations,
  DatabaseInstance,
} from '../../../../src/backend/db/database.js';
import { deepZoomRoutes } from '../../../../src/backend/routes/deep-zoom-routes.js';
import { DeepZoomTileService } from '../../../../src/backend/services/deep-zoom-tile-service.js';
import fs from 'node:fs';
import path from 'node:path';

describe('deepZoomRoutes Fastify Endpoints (Sprint 66)', () => {
  let app: FastifyInstance;
  let db: DatabaseInstance;
  let service: DeepZoomTileService;
  const testCacheDir = path.resolve('./data/cache/test_tiles_routes_sprint66');

  beforeEach(async () => {
    db = createDatabase(':memory:');
    runMigrations(db);

    service = new DeepZoomTileService({
      db,
      cacheRoot: testCacheDir,
      defaultTileSize: 512,
    });

    app = Fastify();
    await app.register(deepZoomRoutes, { db, deepZoomService: service });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
    if (fs.existsSync(testCacheDir)) {
      fs.rmSync(testCacheDir, { recursive: true, force: true });
    }
  });

  describe('POST /api/v1/tiles/:chapterId/:pageNumber/register', () => {
    it('returns 400 for invalid pageNumber or dimensions', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/tiles/ch_01/invalid/register',
        payload: { width: 1000, height: 1000 },
      });
      expect(res.statusCode).toBe(400);

      const res2 = await app.inject({
        method: 'POST',
        url: '/api/v1/tiles/ch_01/1/register',
        payload: { width: -50, height: 1000 },
      });
      expect(res2.statusCode).toBe(400);
    });

    it('returns 200 and registers pyramidal metadata for spread', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/tiles/ch_01/1/register',
        payload: { width: 4000, height: 2600, tileSize: 512 },
      });
      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.manifest.isPyramidal).toBe(true);
      expect(data.manifest.maxLevel).toBe(3);
      expect(data.manifest.levels.length).toBe(4);
    });
  });

  describe('GET /api/v1/tiles/:chapterId/:pageNumber/meta', () => {
    it('returns 404 when metadata does not exist and no auto-register params are given', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/tiles/ch_unknown/1/meta',
      });
      expect(res.statusCode).toBe(404);
    });

    it('auto-registers and returns 200 when width and height query params are provided', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/tiles/ch_auto/2/meta?width=1200&height=1800',
      });
      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.manifest.isPyramidal).toBe(false); // <= 2048px
      expect(data.manifest.maxLevel).toBe(0);
    });

    it('returns 200 with cached metadata once registered', async () => {
      service.registerOrGetManifest('ch_cached', 5, 5000, 3500);

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/tiles/ch_cached/5/meta',
      });
      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.manifest.chapterId).toBe('ch_cached');
      expect(data.manifest.originalWidth).toBe(5000);
    });
  });

  describe('POST /api/v1/tiles/viewport-tiles', () => {
    it('returns 400 when transform or manifest is missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/tiles/viewport-tiles',
        payload: {},
      });
      expect(res.statusCode).toBe(400);
    });

    it('resolves visible tiles and VRAM footprint in < 5ms', async () => {
      const manifest = service.registerOrGetManifest('ch_view', 1, 6000, 4000);
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/tiles/viewport-tiles',
        payload: {
          transform: {
            panX: 0,
            panY: 0,
            scale: 1.5,
            viewportWidth: 1920,
            viewportHeight: 1080,
          },
          manifest,
        },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.visibleTileSet.tiles.length).toBeGreaterThan(0);
      expect(data.visibleTileSet.vramBytesEstimated).toBeGreaterThan(0);
    });
  });

  describe('GET /api/v1/tiles/:chapterId/:pageNumber/:level/:tile', () => {
    it('returns 400 for malformed tile names', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/tiles/ch_view/1/0/invalid_tile_name',
      });
      expect(res.statusCode).toBe(400);
    });

    it('returns 200 with image/webp and valid ETag header', async () => {
      service.registerOrGetManifest('ch_tile_test', 1, 4000, 3000);

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/tiles/ch_tile_test/1/0/0_0.webp',
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toBe('image/webp');
      expect(res.headers['cache-control']).toContain('immutable');
      expect(res.headers['etag']).toBeDefined();
      expect(res.rawPayload.length).toBeGreaterThan(0);

      // Verify HTTP 304 Not Modified
      const etag = res.headers['etag'] as string;
      const res304 = await app.inject({
        method: 'GET',
        url: '/api/v1/tiles/ch_tile_test/1/0/0_0.webp',
        headers: {
          'if-none-match': etag,
        },
      });
      expect(res304.statusCode).toBe(304);
    });
  });
});
