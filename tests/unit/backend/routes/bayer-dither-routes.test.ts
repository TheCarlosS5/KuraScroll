import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import { bayerDitherRoutes } from '../../../../src/backend/routes/bayer-dither-routes.js';
import { BayerDitherService } from '../../../../src/backend/services/bayer-dither-service.js';

describe('Sprint 119 - Bayer Dither Routes', () => {
  let db: DatabaseInstance;
  let app: FastifyInstance;
  let service: BayerDitherService;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS bayer_dither_profiles (
        series_id TEXT PRIMARY KEY,
        preset_name TEXT NOT NULL DEFAULT 'tn_6bit_default' CHECK (preset_name IN (
          'tn_6bit_default',
          'smooth_gradient',
          'dark_interface',
          'photo_conservative',
          'text_protected'
        )),
        matrix_size INTEGER NOT NULL DEFAULT 8 CHECK (matrix_size IN (2, 4, 8, 16)),
        target_bits INTEGER NOT NULL DEFAULT 6 CHECK (target_bits BETWEEN 5 AND 10),
        dither_strength REAL NOT NULL DEFAULT 0.85 CHECK (dither_strength >= 0.0 AND dither_strength <= 1.0),
        edge_protection REAL NOT NULL DEFAULT 0.25 CHECK (edge_protection >= 0.0 AND edge_protection <= 1.0),
        channel_mode TEXT NOT NULL DEFAULT 'shared' CHECK (channel_mode IN ('shared', 'independent')),
        is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_bayer_dither_lookup ON bayer_dither_profiles(series_id);
    `);

    service = new BayerDitherService(db);
    app = Fastify({ logger: false });
    await app.register(bayerDitherRoutes, {
      db,
      bayerDitherService: service,
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

  it('GET /api/v1/reader/bayer-dither/presets returns all predefined presets', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/bayer-dither/presets',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.presets.tn_6bit_default).toBeDefined();
    expect(body.presets.smooth_gradient).toBeDefined();
  });

  it('GET /api/v1/reader/bayer-dither/profile/:seriesId returns default profile and supports 304', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/bayer-dither/profile/series-bayer-route-1',
    });

    expect(res.statusCode).toBe(200);
    const etag = res.headers.etag;
    expect(etag).toBeDefined();

    const resCached = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/bayer-dither/profile/series-bayer-route-1',
      headers: {
        'if-none-match': etag as string,
      },
    });
    expect(resCached.statusCode).toBe(304);
  });

  it('POST /api/v1/reader/bayer-dither/profile updates profile and validates input', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/bayer-dither/profile',
      payload: {
        seriesId: 'series-bayer-route-1',
        presetName: 'smooth_gradient',
        matrixSize: 8,
        targetBits: 6,
        ditherStrength: 1.0,
        edgeProtection: 0.15,
        channelMode: 'shared',
        isEnabled: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.profile.presetName).toBe('smooth_gradient');
    expect(body.profile.ditherStrength).toBe(1.0);
  });

  it('POST /api/v1/reader/bayer-dither/calculate executes Bayer dither calculation', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/bayer-dither/calculate',
      payload: {
        x: 4,
        y: 4,
        r: 128,
        g: 128,
        b: 128,
        matrixSize: 8,
        targetBits: 6,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.result.outR).toBeDefined();
    expect(body.result.packedRgb).toBeDefined();
    expect(body.result.targetBits).toBe(6);
  });
});
