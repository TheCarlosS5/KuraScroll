/**
 * KuraScroll Sprint 104: Eye Rest Routes Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import { eyeRestRoutes, computeEyeRestEtag } from '../../../../src/backend/routes/eye-rest-routes.js';
import { EyeRestService } from '../../../../src/backend/services/eye-rest-service.js';

describe('eyeRestRoutes', () => {
  let app: FastifyInstance;
  let db: DatabaseInstance;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS eye_rest_profiles (
        series_id TEXT PRIMARY KEY,
        shutter_mode TEXT NOT NULL DEFAULT 'subtle_vignette' CHECK (shutter_mode IN (
            'subtle_vignette',
            'focus_spotlight',
            'circadian_warmth',
            'disabled'
        )),
        aperture_radius_px INTEGER NOT NULL DEFAULT 320 CHECK (aperture_radius_px >= 100 AND aperture_radius_px <= 800),
        falloff_pct INTEGER NOT NULL DEFAULT 35 CHECK (falloff_pct >= 10 AND falloff_pct <= 80),
        rest_interval_min INTEGER NOT NULL DEFAULT 20 CHECK (rest_interval_min >= 5 AND rest_interval_min <= 60),
        eye_care_warmth_k INTEGER NOT NULL DEFAULT 3200 CHECK (eye_care_warmth_k >= 2200 AND eye_care_warmth_k <= 6500),
        is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_eye_rest_lookup ON eye_rest_profiles(series_id);
    `);

    app = Fastify();
    await app.register(eyeRestRoutes, {
      db,
      eyeRestService: new EyeRestService(db),
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('GET /api/v1/reader/eye-rest/presets returns 200 with presets', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/eye-rest/presets',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.presets.subtle_vignette).toBeDefined();
    expect(body.presets.focus_spotlight).toBeDefined();
    expect(body.presets.circadian_warmth).toBeDefined();
    expect(body.presets.disabled).toBeDefined();
  });

  it('GET /api/v1/reader/eye-rest/profile/:seriesId returns default profile and ETag header', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/eye-rest/profile/s104-test',
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['etag']).toBeDefined();
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.profile.seriesId).toBe('s104-test');
    expect(body.profile.shutterMode).toBe('subtle_vignette');
  });

  it('GET /api/v1/reader/eye-rest/profile/:seriesId returns 304 when matching ETag is provided', async () => {
    const initialRes = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/eye-rest/profile/s104-test',
    });
    const etag = initialRes.headers['etag'] as string;

    const cachedRes = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/eye-rest/profile/s104-test',
      headers: {
        'if-none-match': etag,
      },
    });
    expect(cachedRes.statusCode).toBe(304);
  });

  it('POST /api/v1/reader/eye-rest/profile updates profile and returns 200', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/eye-rest/profile',
      payload: {
        seriesId: 's104-updated',
        shutterMode: 'circadian_warmth',
        apertureRadiusPx: 400,
        falloffPct: 50,
        restIntervalMin: 25,
        eyeCareWarmthK: 2400,
        isEnabled: true,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.profile.shutterMode).toBe('circadian_warmth');
    expect(body.profile.apertureRadiusPx).toBe(400);
  });

  it('POST /api/v1/reader/eye-rest/profile returns 400 for empty seriesId', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/eye-rest/profile',
      payload: {
        seriesId: '',
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /api/v1/reader/eye-rest/calculate-aperture calculates aperture parameters', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/eye-rest/calculate-aperture',
      payload: {
        anchor: { x: 600, y: 350 },
        apertureRadiusPx: 320,
        falloffPct: 35,
        elapsedReadingMin: 10,
        restIntervalMin: 20,
        eyeCareWarmthK: 3200,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.result.radialGradientCss).toContain('radial-gradient');
    expect(body.result.latencyUs).toBeLessThan(10000);
  });
});
