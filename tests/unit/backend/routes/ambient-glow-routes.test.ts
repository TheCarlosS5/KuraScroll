/**
 * KuraScroll Sprint 92: Ambient Glow Routes Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import { ambientGlowRoutes } from '../../../../src/backend/routes/ambient-glow-routes.js';
import { AmbientGlowService } from '../../../../src/backend/services/ambient-glow-service.js';

describe('ambientGlowRoutes', () => {
  let app: FastifyInstance;
  let db: DatabaseInstance;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS ambient_glow_profiles (
        series_id TEXT PRIMARY KEY,
        glow_mode TEXT NOT NULL DEFAULT 'cinematic_reactive' CHECK (glow_mode IN (
            'cinematic_reactive',
            'dark_monochrome_dim',
            'vibrant_manhwa_bleed',
            'custom'
        )),
        glow_spread_px INTEGER NOT NULL DEFAULT 64 CHECK (glow_spread_px >= 16 AND glow_spread_px <= 256),
        glow_opacity REAL NOT NULL DEFAULT 0.45 CHECK (glow_opacity >= 0.00 AND glow_opacity <= 1.00),
        feather_smoothness REAL NOT NULL DEFAULT 1.20 CHECK (feather_smoothness >= 0.50 AND feather_smoothness <= 3.00),
        is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_ambient_glow_lookup ON ambient_glow_profiles(series_id);
    `);

    app = Fastify();
    await app.register(ambientGlowRoutes, {
      db,
      ambientGlowService: new AmbientGlowService(db),
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('GET /api/v1/reader/ambient-glow/presets returns presets', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/ambient-glow/presets',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.presets.cinematic_reactive).toBeDefined();
    expect(body.presets.dark_monochrome_dim).toBeDefined();
    expect(body.presets.vibrant_manhwa_bleed).toBeDefined();
  });

  it('GET /api/v1/reader/ambient-glow/profile/:seriesId returns default profile with ETag', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/ambient-glow/profile/omniscient-reader',
    });
    expect(res.statusCode).toBe(200);
    const etag = res.headers['etag'];
    expect(etag).toBeDefined();
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.profile.seriesId).toBe('omniscient-reader');
    expect(body.profile.glowMode).toBe('cinematic_reactive');

    // Test ETag 304 Not Modified
    const cachedRes = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/ambient-glow/profile/omniscient-reader',
      headers: {
        'if-none-match': etag as string,
      },
    });
    expect(cachedRes.statusCode).toBe(304);
  });

  it('POST /api/v1/reader/ambient-glow/profile updates profile and returns updated entity', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/ambient-glow/profile',
      payload: {
        seriesId: 'omniscient-reader',
        glowMode: 'vibrant_manhwa_bleed',
        glowSpreadPx: 120,
        glowOpacity: 0.70,
        featherSmoothness: 1.4,
        isEnabled: true,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.profile.seriesId).toBe('omniscient-reader');
    expect(body.profile.glowMode).toBe('vibrant_manhwa_bleed');
    expect(body.profile.glowSpreadPx).toBe(120);
  });

  it('POST /api/v1/reader/ambient-glow/calculate-gradients calculates CSS linear gradients', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/ambient-glow/calculate-gradients',
      payload: {
        glowMode: 'cinematic_reactive',
        spreadPx: 64,
        opacity: 0.45,
        smoothness: 1.20,
        topRgb: '50, 60, 70',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.result.topGradientCss).toContain('linear-gradient(to top');
    expect(body.result.combinedBoxGlowCss).toBeDefined();
  });

  it('returns 400 when missing seriesId parameter', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/ambient-glow/profile',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });
});
