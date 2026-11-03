import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import { darkAdaptationRoutes } from '../../../../src/backend/routes/dark-adaptation-routes.js';
import { DarkAdaptationService } from '../../../../src/backend/services/dark-adaptation-service.js';

describe('Sprint 118 - Dark Adaptation Routes', () => {
  let db: DatabaseInstance;
  let app: FastifyInstance;
  let service: DarkAdaptationService;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS dark_adaptation_profiles (
        series_id TEXT PRIMARY KEY,
        preset_name TEXT NOT NULL DEFAULT 'midnight_reader' CHECK (preset_name IN (
          'night_shonen',
          'midnight_reader',
          'daylight_crisp',
          'paper_sepia'
        )),
        tau_dark_ms INTEGER NOT NULL DEFAULT 1800 CHECK (tau_dark_ms >= 500 AND tau_dark_ms <= 5000),
        tau_bright_ms INTEGER NOT NULL DEFAULT 450 CHECK (tau_bright_ms >= 100 AND tau_bright_ms <= 2000),
        comfort_luminance REAL NOT NULL DEFAULT 0.22 CHECK (comfort_luminance >= 0.05 AND comfort_luminance <= 0.80),
        glare_threshold REAL NOT NULL DEFAULT 0.70 CHECK (glare_threshold >= 0.40 AND glare_threshold <= 0.95),
        base_white_point REAL NOT NULL DEFAULT 0.92 CHECK (base_white_point >= 0.50 AND base_white_point <= 1.0),
        glare_attenuation REAL NOT NULL DEFAULT 0.35 CHECK (glare_attenuation >= 0.0 AND glare_attenuation <= 0.80),
        contrast_base REAL NOT NULL DEFAULT 1.05 CHECK (contrast_base >= 0.80 AND contrast_base <= 1.50),
        contrast_compensation REAL NOT NULL DEFAULT 0.20 CHECK (contrast_compensation >= 0.0 AND contrast_compensation <= 0.50),
        is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_dark_adaptation_lookup ON dark_adaptation_profiles(series_id);
    `);

    service = new DarkAdaptationService(db);
    app = Fastify({ logger: false });
    await app.register(darkAdaptationRoutes, {
      db,
      darkAdaptationService: service,
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

  it('GET /api/v1/reader/dark-adaptation/presets returns all predefined presets', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/dark-adaptation/presets',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.presets.midnight_reader).toBeDefined();
    expect(body.presets.night_shonen).toBeDefined();
  });

  it('GET /api/v1/reader/dark-adaptation/profile/:seriesId returns default profile and supports 304', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/dark-adaptation/profile/series-da-route-1',
    });

    expect(res.statusCode).toBe(200);
    const etag = res.headers.etag;
    expect(etag).toBeDefined();

    const resCached = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/dark-adaptation/profile/series-da-route-1',
      headers: {
        'if-none-match': etag as string,
      },
    });
    expect(resCached.statusCode).toBe(304);
  });

  it('POST /api/v1/reader/dark-adaptation/profile updates profile and validates input', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/dark-adaptation/profile',
      payload: {
        seriesId: 'series-da-route-1',
        presetName: 'night_shonen',
        tauDarkMs: 1600,
        tauBrightMs: 420,
        comfortLuminance: 0.25,
        glareThreshold: 0.72,
        baseWhitePoint: 0.90,
        glareAttenuation: 0.32,
        contrastBase: 1.10,
        contrastCompensation: 0.22,
        isEnabled: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.profile.presetName).toBe('night_shonen');
    expect(body.profile.comfortLuminance).toBe(0.25);
  });

  it('POST /api/v1/reader/dark-adaptation/calculate executes EMA adaptation calculation', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/dark-adaptation/calculate',
      payload: {
        inputLuminance: 0.85,
        prevAdaptedLuminance: 0.20,
        dtMs: 16.67,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.result.adaptedLuminance).toBeGreaterThan(0.20);
    expect(body.result.whitePoint).toBeGreaterThanOrEqual(0.50);
  });
});
