/**
 * KuraScroll Sprint 101: Page Tile Recycler Routes Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import { pageTileRecyclerRoutes, computePageBufferEtag } from '../../../../src/backend/routes/page-tile-recycler-routes.js';
import { PageTileRecyclerService } from '../../../../src/backend/services/page-tile-recycler-service.js';

describe('pageTileRecyclerRoutes', () => {
  let app: FastifyInstance;
  let db: DatabaseInstance;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS page_buffer_profiles (
        series_id TEXT PRIMARY KEY,
        ring_capacity INTEGER NOT NULL DEFAULT 7 CHECK (ring_capacity >= 3 AND ring_capacity <= 15),
        forward_lookahead INTEGER NOT NULL DEFAULT 3 CHECK (forward_lookahead >= 1 AND forward_lookahead <= 10),
        backward_lookahead INTEGER NOT NULL DEFAULT 2 CHECK (backward_lookahead >= 0 AND backward_lookahead <= 5),
        slot_recycling_strategy TEXT NOT NULL DEFAULT 'circular_lru' CHECK (slot_recycling_strategy IN (
            'circular_lru',
            'boustrophedon_ring',
            'pinned_viewport'
        )),
        zero_copy_slice_enabled INTEGER NOT NULL DEFAULT 1 CHECK (zero_copy_slice_enabled IN (0, 1)),
        max_memory_pool_bytes INTEGER NOT NULL DEFAULT 33554432 CHECK (max_memory_pool_bytes >= 8388608 AND max_memory_pool_bytes <= 67108864),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_page_buffer_lookup ON page_buffer_profiles(series_id);
    `);

    app = Fastify();
    await app.register(pageTileRecyclerRoutes, {
      db,
      pageTileRecyclerService: new PageTileRecyclerService(db),
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('GET /api/v1/reader/page-buffer/presets returns 200 with presets', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/page-buffer/presets',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.presets.standard_lru).toBeDefined();
    expect(body.presets.low_ram).toBeDefined();
    expect(body.presets.boustrophedon).toBeDefined();
    expect(body.presets.pinned_viewport).toBeDefined();
  });

  it('GET /api/v1/reader/page-buffer/profile/:seriesId returns default profile and ETag header', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/page-buffer/profile/s101-test',
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['etag']).toBeDefined();
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.profile.seriesId).toBe('s101-test');
    expect(body.profile.ringCapacity).toBe(7);
  });

  it('GET /api/v1/reader/page-buffer/profile/:seriesId returns 304 when matching ETag is provided', async () => {
    const initialRes = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/page-buffer/profile/s101-test',
    });
    const etag = initialRes.headers['etag'] as string;

    const cachedRes = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/page-buffer/profile/s101-test',
      headers: {
        'if-none-match': etag,
      },
    });
    expect(cachedRes.statusCode).toBe(304);
  });

  it('POST /api/v1/reader/page-buffer/profile updates profile and returns 200', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/page-buffer/profile',
      payload: {
        seriesId: 's101-updated',
        ringCapacity: 9,
        forwardLookahead: 4,
        backwardLookahead: 3,
        slotRecyclingStrategy: 'boustrophedon_ring',
        zeroCopySliceEnabled: false,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.profile.ringCapacity).toBe(9);
    expect(body.profile.slotRecyclingStrategy).toBe('boustrophedon_ring');
    expect(body.profile.zeroCopySliceEnabled).toBe(false);
  });

  it('POST /api/v1/reader/page-buffer/profile returns 400 for empty seriesId', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/page-buffer/profile',
      payload: {
        seriesId: '',
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /api/v1/reader/page-buffer/calculate-recycling-matrix calculates matrix result', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/page-buffer/calculate-recycling-matrix',
      payload: {
        currentPageIndex: 4,
        totalPages: 25,
        ringCapacity: 7,
        forwardLookahead: 3,
        backwardLookahead: 2,
        slotRecyclingStrategy: 'circular_lru',
        direction: 'forward',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.matrix.recycledSlotIndex).toBeDefined();
    expect(body.matrix.slots.length).toBe(7);
    expect(body.matrix.latencyUs).toBeLessThan(500);
  });

  it('POST /api/v1/reader/page-buffer/calculate-recycling-matrix returns 400 when missing required fields', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/page-buffer/calculate-recycling-matrix',
      payload: {
        currentPageIndex: 4,
      },
    });
    expect(res.statusCode).toBe(400);
  });
});
