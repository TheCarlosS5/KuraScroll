/**
 * KuraScroll Sprint 89: Adaptive Contrast Dynamic Range & HDR Tone-Mapping Routes Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import { dynamicToneRoutes } from '../../../../src/backend/routes/dynamic-tone-routes.js';
import { DynamicToneService } from '../../../../src/backend/services/dynamic-tone-service.js';

describe('dynamicToneRoutes', () => {
  let app: FastifyInstance;
  let db: DatabaseInstance;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS dynamic_tone_profiles (
        series_id TEXT PRIMARY KEY,
        gamma_exponent REAL NOT NULL DEFAULT 1.15 CHECK (gamma_exponent >= 0.50 AND gamma_exponent <= 2.50),
        black_point_lift REAL NOT NULL DEFAULT 0.04 CHECK (black_point_lift >= 0.00 AND black_point_lift <= 0.25),
        white_point_compress REAL NOT NULL DEFAULT 0.92 CHECK (white_point_compress >= 0.70 AND white_point_compress <= 1.00),
        ambient_adaptation_mode TEXT NOT NULL DEFAULT 'cinema_night' CHECK (ambient_adaptation_mode IN ('cinema_night', 'daylight_boost', 'oled_pure_black')),
        is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_dynamic_tone_lookup ON dynamic_tone_profiles(series_id);
    `);

    app = Fastify();
    await app.register(dynamicToneRoutes, {
      db,
      dynamicToneService: new DynamicToneService(db),
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('GET /api/v1/reader/dynamic-tone/modes returns presets', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/dynamic-tone/modes',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.modes.cinema_night).toBeDefined();
    expect(body.modes.daylight_boost).toBeDefined();
    expect(body.modes.oled_pure_black).toBeDefined();
  });

  it('GET /api/v1/reader/dynamic-tone/profile/:seriesId returns default profile with ETag', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/dynamic-tone/profile/berserk-manga',
    });
    expect(res.statusCode).toBe(200);
    const etag = res.headers['etag'];
    expect(etag).toBeDefined();
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.profile.seriesId).toBe('berserk-manga');
    expect(body.profile.ambientAdaptationMode).toBe('cinema_night');

    // Test ETag 304 Not Modified
    const cachedRes = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/dynamic-tone/profile/berserk-manga',
      headers: {
        'if-none-match': etag as string,
      },
    });
    expect(cachedRes.statusCode).toBe(304);
  });

  it('POST /api/v1/reader/dynamic-tone/profile updates profile and returns updated entity', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/dynamic-tone/profile',
      payload: {
        seriesId: 'berserk-manga',
        gammaExponent: 1.20,
        blackPointLift: 0.05,
        whitePointCompress: 0.90,
        ambientAdaptationMode: 'oled_pure_black',
        isEnabled: true,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.profile.seriesId).toBe('berserk-manga');
    expect(body.profile.gammaExponent).toBe(1.20);
    expect(body.profile.ambientAdaptationMode).toBe('oled_pure_black');
  });

  it('POST /api/v1/reader/dynamic-tone/calculate-params calculates tone mapping CSS string', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/dynamic-tone/calculate-params',
      payload: {
        gamma: 1.15,
        blackLift: 0.04,
        whiteCompress: 0.92,
        mode: 'cinema_night',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.result.cssFilterString).toContain('contrast(');
    expect(body.result.cssFilterString).toContain('brightness(');
    expect(body.result.contrastPercent).toBeGreaterThan(0);
    expect(body.result.brightnessPercent).toBeGreaterThan(0);
  });

  it('returns 400 when missing seriesId parameter', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/dynamic-tone/profile',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });
});
