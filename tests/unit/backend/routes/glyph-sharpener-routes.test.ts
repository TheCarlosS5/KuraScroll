import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import { glyphSharpenerRoutes } from '../../../../src/backend/routes/glyph-sharpener-routes.js';
import { GlyphSharpenerService } from '../../../../src/backend/services/glyph-sharpener-service.js';

describe('Sprint 113 - Glyph Sharpener Routes', () => {
  let db: DatabaseInstance;
  let app: FastifyInstance;
  let service: GlyphSharpenerService;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS glyph_sharpener_profiles (
        series_id TEXT PRIMARY KEY,
        sharpener_mode TEXT NOT NULL DEFAULT 'adaptive_kanji' CHECK (sharpener_mode IN (
            'adaptive_kanji',
            'high_contrast_furigana',
            'kana_light',
            'dense_cjk_compaction',
            'custom_matrix'
        )),
        stroke_density_tier TEXT NOT NULL DEFAULT 'auto' CHECK (stroke_density_tier IN (
            'auto',
            'low_kana_1_5',
            'mid_kanji_6_14',
            'dense_kanji_15_plus'
        )),
        contrast_multiplier REAL NOT NULL DEFAULT 1.15 CHECK (contrast_multiplier >= 1.0 AND contrast_multiplier <= 1.50),
        luminance_gamma REAL NOT NULL DEFAULT 1.05 CHECK (luminance_gamma >= 0.80 AND luminance_gamma <= 1.30),
        stroke_protection_pct INTEGER NOT NULL DEFAULT 65 CHECK (stroke_protection_pct >= 0 AND stroke_protection_pct <= 100),
        is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_glyph_sharpener_lookup ON glyph_sharpener_profiles(series_id);
    `);

    service = new GlyphSharpenerService(db);
    app = Fastify({ logger: false });
    await app.register(glyphSharpenerRoutes, { db, glyphSharpenerService: service });
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

  it('GET /api/v1/reader/glyph-sharpener/profile/:seriesId returns default profile', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/glyph-sharpener/profile/series-glyph-1',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.profile.seriesId).toBe('series-glyph-1');
    expect(body.profile.sharpenerMode).toBe('adaptive_kanji');
    expect(body.profile.contrastMultiplier).toBe(1.15);
    expect(res.headers.etag).toBeDefined();
  });

  it('GET /api/v1/reader/glyph-sharpener/profile/:seriesId supports ETag 304', async () => {
    const initial = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/glyph-sharpener/profile/series-etag',
    });
    const etag = initial.headers.etag;

    const cached = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/glyph-sharpener/profile/series-etag',
      headers: { 'if-none-match': etag },
    });

    expect(cached.statusCode).toBe(304);
  });

  it('POST /api/v1/reader/glyph-sharpener/profile updates profile and validates', async () => {
    const postRes = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/glyph-sharpener/profile',
      payload: {
        seriesId: 'series-glyph-1',
        sharpenerMode: 'high_contrast_furigana',
        contrastMultiplier: 1.25,
        strokeProtectionPct: 40,
      },
    });

    expect(postRes.statusCode).toBe(200);
    const postBody = JSON.parse(postRes.payload);
    expect(postBody.success).toBe(true);
    expect(postBody.profile.sharpenerMode).toBe('high_contrast_furigana');

    const getRes = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/glyph-sharpener/profile/series-glyph-1',
    });
    const getBody = JSON.parse(getRes.payload);
    expect(getBody.profile.sharpenerMode).toBe('high_contrast_furigana');
    expect(getBody.profile.contrastMultiplier).toBe(1.25);
  });

  it('POST /api/v1/reader/glyph-sharpener/calculate computes CSS filter and stroke protection', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/glyph-sharpener/calculate',
      payload: {
        strokeCount: 16,
        devicePixelRatio: 1.0,
        contrastMultiplier: 1.20,
        luminanceGamma: 1.05,
        strokeProtectionPct: 65,
        mode: 'adaptive_kanji',
        isEnabled: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.result.sharpenerMode).toBe('adaptive_kanji');
    expect(body.result.isDenseStrokeCompensated).toBe(true);
    expect(body.result.cssFilter).toContain('contrast(');
    expect(body.result.textRendering).toBe('geometricPrecision');
  });

  it('GET /api/v1/reader/glyph-sharpener/presets returns predefined typographic presets', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/glyph-sharpener/presets',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.presets.adaptive_kanji).toBeDefined();
    expect(body.presets.high_contrast_furigana).toBeDefined();
    expect(body.presets.dense_cjk_compaction).toBeDefined();
  });
});
