/**
 * KuraScroll Sprint 86: Continuous Page In-Viewport Micro-Cache & Sliding Window Route Integration Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import { slidingWindowRoutes } from '../../../../src/backend/routes/sliding-window-routes.js';
import { SlidingWindowService } from '../../../../src/backend/services/sliding-window-service.js';

describe('slidingWindowRoutes', () => {
  let app: FastifyInstance;
  let db: DatabaseInstance;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS sliding_window_profiles (
        series_id TEXT PRIMARY KEY,
        window_size INTEGER NOT NULL DEFAULT 5 CHECK (window_size >= 1 AND window_size <= 20),
        forward_buffer INTEGER NOT NULL DEFAULT 3 CHECK (forward_buffer >= 1 AND forward_buffer <= 10),
        backward_buffer INTEGER NOT NULL DEFAULT 2 CHECK (backward_buffer >= 1 AND backward_buffer <= 10),
        evict_strategy TEXT NOT NULL DEFAULT 'conservative' CHECK (evict_strategy IN ('conservative', 'aggressive', 'preload_heavy')),
        max_cached_bytes INTEGER NOT NULL DEFAULT 26214400 CHECK (max_cached_bytes >= 5242880 AND max_cached_bytes <= 104857600),
        is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sliding_window_lookup ON sliding_window_profiles(series_id);
    `);

    app = Fastify();
    await app.register(slidingWindowRoutes, {
      db,
      slidingWindowService: new SlidingWindowService(db),
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('GET /api/v1/reader/sliding-window/modes returns presets', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/sliding-window/modes',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.modes.conservative).toBeDefined();
    expect(body.modes.aggressive).toBeDefined();
    expect(body.modes.preload_heavy).toBeDefined();
  });

  it('GET /api/v1/reader/sliding-window/profile/:seriesId returns default profile with ETag', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/sliding-window/profile/solo-leveling',
    });
    expect(res.statusCode).toBe(200);
    const etag = res.headers['etag'];
    expect(etag).toBeDefined();
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.profile.seriesId).toBe('solo-leveling');
    expect(body.profile.evictStrategy).toBe('conservative');

    // Test ETag 304 Not Modified
    const cachedRes = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/sliding-window/profile/solo-leveling',
      headers: {
        'if-none-match': etag as string,
      },
    });
    expect(cachedRes.statusCode).toBe(304);
  });

  it('POST /api/v1/reader/sliding-window/profile updates profile and returns updated entity', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/sliding-window/profile',
      payload: {
        seriesId: 'tower-of-god',
        windowSize: 7,
        forwardBuffer: 4,
        backwardBuffer: 3,
        evictStrategy: 'aggressive',
        isEnabled: true,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.profile.seriesId).toBe('tower-of-god');
    expect(body.profile.windowSize).toBe(7);
    expect(body.profile.forwardBuffer).toBe(4);
    expect(body.profile.evictStrategy).toBe('aggressive');
  });

  it('POST /api/v1/reader/sliding-window/calculate-indices computes window correctly', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/sliding-window/calculate-indices',
      payload: {
        totalCount: 40,
        currentIndex: 15,
        forwardBuffer: 3,
        backwardBuffer: 2,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.result.startIndex).toBe(13);
    expect(body.result.endIndex).toBe(18);
    expect(body.result.activeCount).toBe(6);
    expect(body.result.prefetchIndices).toEqual([16, 17, 18]);
  });

  it('handles bad request on invalid params', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/sliding-window/profile',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });
});
