/**
 * KuraScroll Sprint 97: Text Equalizer Routes Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import { textEqualizerRoutes, computeTextEqualizerEtag } from '../../../../src/backend/routes/text-equalizer-routes.js';
import { TextEqualizerService } from '../../../../src/backend/services/text-equalizer-service.js';

describe('textEqualizerRoutes', () => {
  let app: FastifyInstance;
  let db: DatabaseInstance;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS text_equalizer_profiles (
        series_id TEXT PRIMARY KEY,
        equalizer_mode TEXT NOT NULL DEFAULT 'newsprint_vintage' CHECK (equalizer_mode IN (
            'newsprint_vintage',
            'glossy_digital',
            'faded_doujin',
            'custom'
        )),
        black_level_boost REAL NOT NULL DEFAULT 0.35 CHECK (black_level_boost >= 0.00 AND black_level_boost <= 1.00),
        white_level_compression REAL NOT NULL DEFAULT 0.20 CHECK (white_level_compression >= 0.00 AND white_level_compression <= 1.00),
        kanji_clarity_factor REAL NOT NULL DEFAULT 1.30 CHECK (kanji_clarity_factor >= 1.00 AND kanji_clarity_factor <= 2.50),
        is_furigana_sharpen_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_furigana_sharpen_enabled IN (0, 1)),
        is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_text_equalizer_lookup ON text_equalizer_profiles(series_id);
    `);

    app = Fastify();
    await app.register(textEqualizerRoutes, {
      db,
      textEqualizerService: new TextEqualizerService(db),
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('GET /api/v1/reader/text-equalizer/presets returns presets', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/text-equalizer/presets',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.presets.newsprint_vintage).toBeDefined();
    expect(body.presets.glossy_digital).toBeDefined();
    expect(body.presets.faded_doujin).toBeDefined();
    expect(body.presets.custom).toBeDefined();
  });

  it('GET /api/v1/reader/text-equalizer/profile/:seriesId returns default profile with ETag', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/text-equalizer/profile/berserk-volume',
    });
    expect(res.statusCode).toBe(200);
    const etag = res.headers['etag'];
    expect(etag).toBeDefined();

    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.profile.seriesId).toBe('berserk-volume');
    expect(body.profile.equalizerMode).toBe('newsprint_vintage');

    // 304 Not Modified check
    const cachedRes = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/text-equalizer/profile/berserk-volume',
      headers: {
        'if-none-match': etag as string,
      },
    });
    expect(cachedRes.statusCode).toBe(304);
  });

  it('POST /api/v1/reader/text-equalizer/profile updates profile and invalidates cache', async () => {
    const postRes = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/text-equalizer/profile',
      payload: {
        seriesId: 'berserk-volume',
        equalizerMode: 'faded_doujin',
        blackLevelBoost: 0.55,
        whiteLevelCompression: 0.30,
        kanjiClarityFactor: 1.60,
        isFuriganaSharpenEnabled: true,
        isEnabled: true,
      },
    });
    expect(postRes.statusCode).toBe(200);
    const postBody = postRes.json();
    expect(postBody.success).toBe(true);
    expect(postBody.profile.equalizerMode).toBe('faded_doujin');
    expect(postBody.profile.blackLevelBoost).toBe(0.55);

    const getRes = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/text-equalizer/profile/berserk-volume',
    });
    expect(getRes.statusCode).toBe(200);
    const getBody = getRes.json();
    expect(getBody.profile.equalizerMode).toBe('faded_doujin');
  });

  it('POST /api/v1/reader/text-equalizer/calculate-equalizer-matrix returns valid CSS matrices', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/text-equalizer/calculate-equalizer-matrix',
      payload: {
        blackBoost: 0.35,
        whiteCompression: 0.20,
        kanjiClarity: 1.30,
        isFuriganaSharpen: true,
        mode: 'newsprint_vintage',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.result.effectiveContrast).toBe(1.16);
    expect(body.result.effectiveBrightness).toBe(0.98);
    expect(body.result.compositeFilterCss).toContain('contrast');
    expect(body.result.subpixelMatrixCss).toContain('drop-shadow');
  });

  it('computes consistent ETag', () => {
    const etag1 = computeTextEqualizerEtag('s1', 'newsprint_vintage', 0.35, 0.20, 1.30, true, true, 100);
    const etag2 = computeTextEqualizerEtag('s1', 'newsprint_vintage', 0.35, 0.20, 1.30, true, true, 100);
    const etag3 = computeTextEqualizerEtag('s1', 'glossy_digital', 0.15, 0.10, 1.15, false, true, 100);
    expect(etag1).toBe(etag2);
    expect(etag1).not.toBe(etag3);
  });
});
