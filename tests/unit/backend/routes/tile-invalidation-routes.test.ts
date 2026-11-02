import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import { tileInvalidationRoutes } from '../../../../src/backend/routes/tile-invalidation-routes.js';
import { TileInvalidationService } from '../../../../src/backend/services/tile-invalidation-service.js';

describe('Sprint 107 - Tile Invalidation Routes', () => {
  let db: DatabaseInstance;
  let app: FastifyInstance;
  let service: TileInvalidationService;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS tile_invalidation_profiles (
        series_id TEXT PRIMARY KEY,
        max_heap_mb REAL NOT NULL DEFAULT 128.0 CHECK (max_heap_mb >= 32.0 AND max_heap_mb <= 256.0),
        viewport_margin_px REAL NOT NULL DEFAULT 600.0 CHECK (viewport_margin_px >= 100.0 AND viewport_margin_px <= 2000.0),
        warm_margin_px REAL NOT NULL DEFAULT 1500.0 CHECK (warm_margin_px >= 500.0 AND warm_margin_px <= 5000.0),
        eviction_budget_ms REAL NOT NULL DEFAULT 1.5 CHECK (eviction_budget_ms >= 0.5 AND eviction_budget_ms <= 8.0),
        velocity_weight REAL NOT NULL DEFAULT 0.65 CHECK (velocity_weight >= 0.00 AND velocity_weight <= 1.00),
        recency_weight REAL NOT NULL DEFAULT 0.25 CHECK (recency_weight >= 0.00 AND recency_weight <= 1.00),
        size_weight REAL NOT NULL DEFAULT 0.10 CHECK (size_weight >= 0.00 AND size_weight <= 1.00),
        is_auto_gc_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_auto_gc_enabled IN (0, 1)),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_tile_invalidation_lookup ON tile_invalidation_profiles(series_id);
    `);

    service = new TileInvalidationService(db);
    app = Fastify({ logger: false });
    await app.register(tileInvalidationRoutes, { db, tileInvalidationService: service });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    try {
      db.close();
    } catch {
      // ignore
    }
  });

  it('GET /api/v1/reader/tile-invalidation/profile/:seriesId returns default profile', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/tile-invalidation/profile/series-abc',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.profile.seriesId).toBe('series-abc');
    expect(body.profile.maxHeapMb).toBe(128.0);
    expect(res.headers.etag).toBeDefined();
  });

  it('GET /api/v1/reader/tile-invalidation/profile/:seriesId supports ETag 304', async () => {
    const initial = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/tile-invalidation/profile/series-etag',
    });
    const etag = initial.headers.etag;

    const cached = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/tile-invalidation/profile/series-etag',
      headers: { 'if-none-match': etag },
    });

    expect(cached.statusCode).toBe(304);
  });

  it('POST /api/v1/reader/tile-invalidation/profile updates profile', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/tile-invalidation/profile',
      payload: {
        seriesId: 'series-update',
        maxHeapMb: 64.0,
        viewportMarginPx: 400.0,
        isAutoGcEnabled: false,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.profile.seriesId).toBe('series-update');
    expect(body.profile.maxHeapMb).toBe(64.0);
    expect(body.profile.isAutoGcEnabled).toBe(false);
  });

  it('POST /api/v1/reader/tile-invalidation/profile returns 400 on empty seriesId', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/tile-invalidation/profile',
      payload: { seriesId: '' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('POST /api/v1/reader/tile-invalidation/calculate executes zero-allocation evaluation', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/tile-invalidation/calculate',
      payload: {
        tiles: [
          {
            id: 'tile-1',
            x: 100,
            y: 100,
            width: 256,
            height: 256,
            sizeBytes: 120000,
            lastAccessedEpochMs: 100000,
          },
        ],
        kinematics: {
          viewportX: 0,
          viewportY: 0,
          viewportWidth: 1280,
          viewportHeight: 720,
          velocityX: 0,
          velocityY: 0,
          nowEpochMs: 101000,
          currentHeapMb: 60,
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.result.activeCount).toBe(1);
    expect(body.result.evaluationLatencyUs).toBeLessThan(10000);
  });

  it('GET /api/v1/reader/tile-invalidation/presets returns predefined presets', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/tile-invalidation/presets',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.presets.balanced).toBeDefined();
    expect(body.presets.ultra_low_ram).toBeDefined();
  });
});
