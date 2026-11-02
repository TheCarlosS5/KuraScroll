import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import { halftoneGrainRoutes } from '../../../../src/backend/routes/halftone-grain-routes.js';
import { HalftoneGrainService } from '../../../../src/backend/services/halftone-grain-service.js';

describe('Sprint 115 - Halftone Grain Routes', () => {
  let db: DatabaseInstance;
  let app: FastifyInstance;
  let service: HalftoneGrainService;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS halftone_grain_profiles (
        series_id TEXT PRIMARY KEY,
        grain_mode TEXT NOT NULL DEFAULT 'shonen_jump_pulp' CHECK (grain_mode IN (
          'shonen_jump_pulp',
          'tankobon_newsprint',
          'doujin_matte_offset',
          'archival_acid_free',
          'custom_stipple'
        )),
        stipple_density REAL NOT NULL DEFAULT 0.16 CHECK (stipple_density >= 0.05 AND stipple_density <= 0.40),
        grain_opacity REAL NOT NULL DEFAULT 0.055 CHECK (grain_opacity >= 0.01 AND grain_opacity <= 0.20),
        particle_radius_px REAL NOT NULL DEFAULT 0.8 CHECK (particle_radius_px >= 0.5 AND particle_radius_px <= 2.0),
        lcg_seed INTEGER NOT NULL DEFAULT 1337 CHECK (lcg_seed >= 0 AND lcg_seed <= 2147483647),
        paper_tint_hex TEXT NOT NULL DEFAULT '#FAF6EE',
        blend_mode TEXT NOT NULL DEFAULT 'multiply' CHECK (blend_mode IN ('multiply', 'darken', 'normal', 'overlay')),
        is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_halftone_grain_lookup ON halftone_grain_profiles(series_id);
    `);

    service = new HalftoneGrainService(db);
    app = Fastify({ logger: false });
    await app.register(halftoneGrainRoutes, {
      db,
      halftoneGrainService: service,
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

  it('GET /api/v1/reader/halftone-grain/presets returns all predefined presets', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/halftone-grain/presets',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.presets.shonen_jump_pulp).toBeDefined();
    expect(body.presets.tankobon_newsprint).toBeDefined();
  });

  it('GET /api/v1/reader/halftone-grain/profile/:seriesId returns default profile', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/halftone-grain/profile/series-grain-route-1',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.profile.grainMode).toBe('shonen_jump_pulp');
    expect(body.profile.stippleDensity).toBe(0.16);
    expect(res.headers.etag).toBeDefined();
  });

  it('GET /api/v1/reader/halftone-grain/profile/:seriesId returns 304 with matching ETag', async () => {
    const firstRes = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/halftone-grain/profile/series-grain-etag-1',
    });
    const etag = firstRes.headers.etag as string;

    const secondRes = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/halftone-grain/profile/series-grain-etag-1',
      headers: {
        'if-none-match': etag,
      },
    });

    expect(secondRes.statusCode).toBe(304);
  });

  it('POST /api/v1/reader/halftone-grain/profile saves updated profile', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/halftone-grain/profile',
      payload: {
        seriesId: 'series-post-grain-1',
        grainMode: 'archival_acid_free',
        stippleDensity: 0.1,
        grainOpacity: 0.03,
        paperTintHex: '#FFFDF0',
        blendMode: 'darken',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.profile.grainMode).toBe('archival_acid_free');
    expect(body.profile.blendMode).toBe('darken');
  });

  it('POST /api/v1/reader/halftone-grain/calculate performs real-time parameter calculation', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/halftone-grain/calculate',
      payload: {
        density: 0.18,
        opacity: 0.065,
        radiusPx: 0.9,
        grainMode: 'shonen_jump_pulp',
        isEnabled: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.result.stippleDensity).toBe(0.18);
    expect(body.result.cssBackgroundRepeat).toBe('repeat');
    expect(body.result.estimatedMemoryKiB).toBe(16);
  });
});
