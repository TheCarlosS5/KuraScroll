import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import { tilePrefetchRoutes } from '../../../../src/backend/routes/tile-prefetch-routes.js';
import {
  TilePrefetchService,
  resetPrefetchRingBuffer,
} from '../../../../src/backend/services/tile-prefetch-service.js';

describe('Sprint 117 - Tile Prefetch Routes', () => {
  let db: DatabaseInstance;
  let app: FastifyInstance;
  let service: TilePrefetchService;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS tile_prefetch_profiles (
        series_id TEXT PRIMARY KEY,
        reading_flow TEXT NOT NULL DEFAULT 'manga_rtl' CHECK (reading_flow IN ('manga_rtl', 'comic_ltr', 'webtoon_vertical', 'cinematic_dynamic')),
        prediction_horizon_ms INTEGER NOT NULL DEFAULT 350 CHECK (prediction_horizon_ms >= 100 AND prediction_horizon_ms <= 1000),
        recency_tau_ms INTEGER NOT NULL DEFAULT 8000 CHECK (recency_tau_ms >= 1000 AND recency_tau_ms <= 30000),
        max_prefetch_tiles INTEGER NOT NULL DEFAULT 3 CHECK (max_prefetch_tiles >= 1 AND max_prefetch_tiles <= 8),
        hysteresis_threshold REAL NOT NULL DEFAULT 0.65 CHECK (hysteresis_threshold >= 0.50 AND hysteresis_threshold <= 0.90),
        is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_tile_prefetch_lookup ON tile_prefetch_profiles(series_id);
    `);

    service = new TilePrefetchService(db);
    resetPrefetchRingBuffer();
    app = Fastify({ logger: false });
    await app.register(tilePrefetchRoutes, {
      db,
      tilePrefetchService: service,
    });
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

  it('GET /api/v1/reader/tile-prefetch/presets returns all predefined profiles', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/tile-prefetch/presets',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.presets.manga_rtl).toBeDefined();
    expect(body.presets.webtoon_vertical).toBeDefined();
  });

  it('GET /api/v1/reader/tile-prefetch/profile/:seriesId returns default profile and supports 304', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/tile-prefetch/profile/series-tp-route-1',
    });

    expect(res.statusCode).toBe(200);
    const etag = res.headers.etag;
    expect(etag).toBeDefined();

    const resCached = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/tile-prefetch/profile/series-tp-route-1',
      headers: {
        'if-none-match': etag as string,
      },
    });
    expect(resCached.statusCode).toBe(304);
  });

  it('POST /api/v1/reader/tile-prefetch/profile updates profile and validates input', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/tile-prefetch/profile',
      payload: {
        seriesId: 'series-tp-route-1',
        readingFlow: 'cinematic_dynamic',
        predictionHorizonMs: 400,
        recencyTauMs: 9000,
        maxPrefetchTiles: 4,
        hysteresisThreshold: 0.70,
        isEnabled: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.profile.readingFlow).toBe('cinematic_dynamic');
    expect(body.profile.predictionHorizonMs).toBe(400);
  });

  it('POST /api/v1/reader/tile-prefetch/calculate executes Markov prefetch evaluation', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/tile-prefetch/calculate',
      payload: {
        currentTileId: 10,
        candidateTileId: 11,
        transitionWeight: 0.85,
        hysteresisThreshold: 0.65,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.result.shouldPrefetch).toBe(true);
    expect(body.result.selectedTileId).toBe(11);
    expect(body.result.slotIndex).toBeGreaterThanOrEqual(0);
  });

  it('GET /api/v1/reader/tile-prefetch/ring-buffer returns live ring buffer telemetry', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/tile-prefetch/ring-buffer',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.ringBuffer.capacity).toBe(64);
    expect(Array.isArray(body.ringBuffer.slots)).toBe(true);
  });
});
