/**
 * KuraScroll Sprint 87: Progressive Image Decompression & Chunked Bitstream Routes Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import { chunkedStreamRoutes } from '../../../../src/backend/routes/chunked-stream-routes.js';
import { ChunkedStreamService } from '../../../../src/backend/services/chunked-stream-service.js';

describe('chunkedStreamRoutes', () => {
  let app: FastifyInstance;
  let db: DatabaseInstance;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS chunked_stream_profiles (
        series_id TEXT PRIMARY KEY,
        chunk_height_px INTEGER NOT NULL DEFAULT 1024 CHECK (chunk_height_px >= 256 AND chunk_height_px <= 2048),
        bitstream_quality INTEGER NOT NULL DEFAULT 80 CHECK (bitstream_quality >= 30 AND bitstream_quality <= 100),
        progressive_pass_count INTEGER NOT NULL DEFAULT 2 CHECK (progressive_pass_count >= 1 AND progressive_pass_count <= 4),
        idle_slice_budget_ms REAL NOT NULL DEFAULT 8.0 CHECK (idle_slice_budget_ms >= 1.0 AND idle_slice_budget_ms <= 16.0),
        is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_chunked_stream_lookup ON chunked_stream_profiles(series_id);
    `);

    app = Fastify();
    await app.register(chunkedStreamRoutes, {
      db,
      chunkedStreamService: new ChunkedStreamService(db),
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('GET /api/v1/reader/chunked-stream/presets returns presets list', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/chunked-stream/presets',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.presets.webtoon_conservative).toBeDefined();
    expect(body.presets.low_vram_aggressive).toBeDefined();
  });

  it('GET /api/v1/reader/chunked-stream/profile/:seriesId returns default profile with ETag', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/chunked-stream/profile/manhwa-hero',
    });
    expect(res.statusCode).toBe(200);
    const etag = res.headers['etag'];
    expect(etag).toBeDefined();
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.profile.seriesId).toBe('manhwa-hero');
    expect(body.profile.chunkHeightPx).toBe(1024);

    // ETag 304 Not Modified
    const cachedRes = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/chunked-stream/profile/manhwa-hero',
      headers: {
        'if-none-match': etag as string,
      },
    });
    expect(cachedRes.statusCode).toBe(304);
  });

  it('POST /api/v1/reader/chunked-stream/profile updates profile and returns updated entity', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/chunked-stream/profile',
      payload: {
        seriesId: 'solo-leveling-webtoon',
        chunkHeightPx: 512,
        bitstreamQuality: 75,
        progressivePassCount: 1,
        idleSliceBudgetMs: 5.0,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.profile.seriesId).toBe('solo-leveling-webtoon');
    expect(body.profile.chunkHeightPx).toBe(512);
    expect(body.profile.idleSliceBudgetMs).toBe(5.0);
  });

  it('POST /api/v1/reader/chunked-stream/calculate-slices calculates slices correctly', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/chunked-stream/calculate-slices',
      payload: {
        totalWidth: 1000,
        totalHeight: 3000,
        maxChunkDim: 1024,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.result.cols).toBe(1);
    expect(body.result.rows).toBe(3);
    expect(body.result.totalSlices).toBe(3);
  });

  it('returns 400 when missing required parameters', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/chunked-stream/calculate-slices',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });
});
