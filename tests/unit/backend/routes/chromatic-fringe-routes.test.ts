/**
 * KuraScroll Sprint 91: Chromatic Fringe Routes Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import { chromaticFringeRoutes } from '../../../../src/backend/routes/chromatic-fringe-routes.js';
import { ChromaticFringeService } from '../../../../src/backend/services/chromatic-fringe-service.js';

describe('chromaticFringeRoutes', () => {
  let app: FastifyInstance;
  let db: DatabaseInstance;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS chromatic_fringe_profiles (
        series_id TEXT PRIMARY KEY,
        neutralizer_mode TEXT NOT NULL DEFAULT 'subpixel_rgb' CHECK (neutralizer_mode IN (
            'subpixel_rgb',
            'subpixel_bgr',
            'monochrome_ink',
            'custom'
        )),
        fringe_radius_px REAL NOT NULL DEFAULT 0.75 CHECK (fringe_radius_px >= 0.10 AND fringe_radius_px <= 2.50),
        desaturation_strength REAL NOT NULL DEFAULT 0.60 CHECK (desaturation_strength >= 0.00 AND desaturation_strength <= 1.00),
        sharpening_amount REAL NOT NULL DEFAULT 1.25 CHECK (sharpening_amount >= 0.50 AND sharpening_amount <= 3.00),
        is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_chromatic_fringe_lookup ON chromatic_fringe_profiles(series_id);
    `);

    app = Fastify();
    await app.register(chromaticFringeRoutes, {
      db,
      chromaticFringeService: new ChromaticFringeService(db),
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('GET /api/v1/reader/chromatic-fringe/presets returns presets', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/chromatic-fringe/presets',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.presets.subpixel_rgb).toBeDefined();
    expect(body.presets.subpixel_bgr).toBeDefined();
    expect(body.presets.monochrome_ink).toBeDefined();
  });

  it('GET /api/v1/reader/chromatic-fringe/profile/:seriesId returns default profile with ETag', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/chromatic-fringe/profile/vagabond',
    });
    expect(res.statusCode).toBe(200);
    const etag = res.headers['etag'];
    expect(etag).toBeDefined();
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.profile.seriesId).toBe('vagabond');
    expect(body.profile.neutralizerMode).toBe('subpixel_rgb');

    // Test ETag 304 Not Modified
    const cachedRes = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/chromatic-fringe/profile/vagabond',
      headers: {
        'if-none-match': etag as string,
      },
    });
    expect(cachedRes.statusCode).toBe(304);
  });

  it('POST /api/v1/reader/chromatic-fringe/profile updates profile and returns updated entity', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/chromatic-fringe/profile',
      payload: {
        seriesId: 'vagabond',
        neutralizerMode: 'monochrome_ink',
        fringeRadiusPx: 1.15,
        desaturationStrength: 0.90,
        sharpeningAmount: 1.5,
        isEnabled: true,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.profile.seriesId).toBe('vagabond');
    expect(body.profile.neutralizerMode).toBe('monochrome_ink');
    expect(body.profile.fringeRadiusPx).toBe(1.15);
  });

  it('POST /api/v1/reader/chromatic-fringe/calculate-matrix calculates CSS & SVG filter', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/chromatic-fringe/calculate-matrix',
      payload: {
        mode: 'subpixel_rgb',
        fringeRadius: 0.75,
        desaturation: 0.60,
        sharpening: 1.25,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.result.cssFilterString).toContain('saturate(');
    expect(body.result.cssFilterString).toContain('contrast(');
    expect(body.result.svgMatrixString).toBeDefined();
  });

  it('returns 400 when missing seriesId parameter', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/chromatic-fringe/profile',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });
});
