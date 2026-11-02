/**
 * KuraScroll Sprint 106: Balloon Font Routes Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import { balloonFontRoutes, computeBalloonFontEtag } from '../../../../src/backend/routes/balloon-font-routes.js';
import { BalloonFontService } from '../../../../src/backend/services/balloon-font-service.js';

describe('balloonFontRoutes', () => {
  let app: FastifyInstance;
  let db: DatabaseInstance;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS balloon_font_profiles (
        series_id TEXT PRIMARY KEY,
        scaling_mode TEXT NOT NULL DEFAULT 'comfort_legibility' CHECK (scaling_mode IN (
            'comfort_legibility',
            'compact_dialogue',
            'large_print',
            'disabled',
            'custom'
        )),
        min_font_size_px INTEGER NOT NULL DEFAULT 10 CHECK (min_font_size_px >= 6 AND min_font_size_px <= 24),
        max_font_size_px INTEGER NOT NULL DEFAULT 32 CHECK (max_font_size_px >= 16 AND max_font_size_px <= 72),
        target_density_ratio REAL NOT NULL DEFAULT 0.65 CHECK (target_density_ratio >= 0.20 AND target_density_ratio <= 0.95),
        is_furigana_preserved INTEGER NOT NULL DEFAULT 1 CHECK (is_furigana_preserved IN (0, 1)),
        is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_balloon_font_lookup ON balloon_font_profiles(series_id);
    `);

    app = Fastify();
    await app.register(balloonFontRoutes, {
      db,
      balloonFontService: new BalloonFontService(db),
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('GET /api/v1/reader/balloon-font/presets returns 200 with presets', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/balloon-font/presets',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.presets)).toBe(true);
    expect(body.presets.length).toBeGreaterThanOrEqual(4);
  });

  it('GET /api/v1/reader/balloon-font/profile/:seriesId returns default profile and ETag header', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/balloon-font/profile/s106-test',
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['etag']).toBeDefined();
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.profile.seriesId).toBe('s106-test');
    expect(body.profile.scalingMode).toBe('comfort_legibility');
  });

  it('GET /api/v1/reader/balloon-font/profile/:seriesId returns 304 when matching ETag is provided', async () => {
    const initialRes = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/balloon-font/profile/s106-test',
    });
    expect(initialRes.statusCode).toBe(200);
    const etag = initialRes.headers['etag'] as string;

    const cachedRes = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/balloon-font/profile/s106-test',
      headers: {
        'if-none-match': etag,
      },
    });
    expect(cachedRes.statusCode).toBe(304);
  });

  it('POST /api/v1/reader/balloon-font/profile upserts and modifies profile', async () => {
    const postRes = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/balloon-font/profile',
      payload: {
        seriesId: 's106-saved',
        scalingMode: 'compact_dialogue',
        minFontSizePx: 10,
        maxFontSizePx: 22,
        targetDensityRatio: 0.80,
        isFuriganaPreserved: false,
      },
    });

    expect(postRes.statusCode).toBe(200);
    const postBody = postRes.json();
    expect(postBody.success).toBe(true);
    expect(postBody.profile.scalingMode).toBe('compact_dialogue');
    expect(postBody.profile.minFontSizePx).toBe(10);

    const getRes = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/balloon-font/profile/s106-saved',
    });
    expect(getRes.statusCode).toBe(200);
    expect(getRes.json().profile.scalingMode).toBe('compact_dialogue');
  });

  it('POST /api/v1/reader/balloon-font/calculate computes optical font scaling', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/balloon-font/calculate',
      payload: {
        balloonWidth: 260,
        balloonHeight: 190,
        textLength: 35,
        viewportWidth: 1280,
        viewportHeight: 720,
        minFontSizePx: 12,
        maxFontSizePx: 28,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.result.optimalFontSizePx).toBeGreaterThanOrEqual(12);
    expect(body.result.scaleRatio).toBeGreaterThan(0);
    expect(body.result.latencyUs).toBeLessThan(10000);
  });

  it('POST /api/v1/reader/balloon-font/profile returns 400 on empty seriesId', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/balloon-font/profile',
      payload: { seriesId: '' },
    });
    expect(res.statusCode).toBe(400);
  });
});
