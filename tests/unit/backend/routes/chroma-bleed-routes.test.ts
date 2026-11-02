import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import { chromaBleedRoutes } from '../../../../src/backend/routes/chroma-bleed-routes.js';
import { ChromaBleedService } from '../../../../src/backend/services/chroma-bleed-service.js';

describe('Sprint 110 - Chroma Bleed Routes', () => {
  let db: DatabaseInstance;
  let app: FastifyInstance;
  let service: ChromaBleedService;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS chroma_bleed_profiles (
        series_id TEXT PRIMARY KEY,
        color_mode TEXT NOT NULL DEFAULT 'monochrome_bw' CHECK (color_mode IN (
            'monochrome_bw',
            'sepia_vintage',
            'night_crimson',
            'cyberpunk_neon',
            'oled_pitch_black',
            'custom'
        )),
        color_temperature_k INTEGER NOT NULL DEFAULT 6500 CHECK (color_temperature_k >= 2000 AND color_temperature_k <= 9000),
        bleed_spread_px INTEGER NOT NULL DEFAULT 24 CHECK (bleed_spread_px >= 8 AND bleed_spread_px <= 64),
        ambient_intensity_pct INTEGER NOT NULL DEFAULT 35 CHECK (ambient_intensity_pct >= 0 AND ambient_intensity_pct <= 100),
        edge_falloff_exponent REAL NOT NULL DEFAULT 2.2 CHECK (edge_falloff_exponent >= 1.0 AND edge_falloff_exponent <= 4.0),
        is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_chroma_bleed_lookup ON chroma_bleed_profiles(series_id);
    `);

    service = new ChromaBleedService(db);
    app = Fastify({ logger: false });
    await app.register(chromaBleedRoutes, { db, chromaBleedService: service });
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

  it('GET /api/v1/reader/chroma-bleed/profile/:seriesId returns default profile', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/chroma-bleed/profile/series-bleed-1',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.profile.seriesId).toBe('series-bleed-1');
    expect(body.profile.colorMode).toBe('monochrome_bw');
    expect(body.profile.colorTemperatureK).toBe(6500);
    expect(res.headers.etag).toBeDefined();
  });

  it('GET /api/v1/reader/chroma-bleed/profile/:seriesId supports ETag 304', async () => {
    const initial = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/chroma-bleed/profile/series-etag',
    });
    const etag = initial.headers.etag;

    const cached = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/chroma-bleed/profile/series-etag',
      headers: { 'if-none-match': etag },
    });

    expect(cached.statusCode).toBe(304);
  });

  it('POST /api/v1/reader/chroma-bleed/profile updates profile', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/chroma-bleed/profile',
      payload: {
        seriesId: 'series-bleed-update',
        colorMode: 'night_crimson',
        colorTemperatureK: 2200,
        bleedSpreadPx: 40,
        ambientIntensityPct: 30,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.profile.seriesId).toBe('series-bleed-update');
    expect(body.profile.colorMode).toBe('night_crimson');
    expect(body.profile.colorTemperatureK).toBe(2200);
  });

  it('POST /api/v1/reader/chroma-bleed/calculate evaluates ambient gradient and luminance', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/chroma-bleed/calculate',
      payload: {
        colorTemperatureK: 3200,
        bleedSpreadPx: 32,
        ambientIntensityPct: 45,
        edgeFalloffExponent: 2.0,
        colorMode: 'sepia_vintage',
        isEnabled: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.result.colorMode).toBe('sepia_vintage');
    expect(body.result.topGradient).toContain('linear-gradient');
    expect(body.result.perimeterShadow).toContain('inset');
    expect(body.result.latencyUs).toBeLessThan(100);
  });

  it('GET /api/v1/reader/chroma-bleed/presets returns all ambient chroma presets', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/chroma-bleed/presets',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.presets.monochrome_bw).toBeDefined();
    expect(body.presets.sepia_vintage).toBeDefined();
    expect(body.presets.night_crimson).toBeDefined();
    expect(body.presets.cyberpunk_neon).toBeDefined();
    expect(body.presets.oled_pitch_black).toBeDefined();
  });
});
