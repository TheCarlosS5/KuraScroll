/**
 * KuraScroll Sprint 90: Bi-Directional History Scrubber Routes Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import { historyScrubberRoutes } from '../../../../src/backend/routes/history-scrubber-routes.js';
import { HistoryScrubberService } from '../../../../src/backend/services/history-scrubber-service.js';

describe('historyScrubberRoutes', () => {
  let app: FastifyInstance;
  let db: DatabaseInstance;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS history_scrubber_profiles (
        series_id TEXT PRIMARY KEY,
        scrubber_mode TEXT NOT NULL DEFAULT 'webtoon_continuous' CHECK (scrubber_mode IN (
            'webtoon_continuous',
            'manga_rtl_continuous',
            'manga_ltr_continuous'
        )),
        tape_thickness_px INTEGER NOT NULL DEFAULT 48 CHECK (tape_thickness_px >= 24 AND tape_thickness_px <= 120),
        heatmap_intensity REAL NOT NULL DEFAULT 0.65 CHECK (heatmap_intensity >= 0.00 AND heatmap_intensity <= 1.00),
        velocity_multiplier REAL NOT NULL DEFAULT 1.20 CHECK (velocity_multiplier >= 0.50 AND velocity_multiplier <= 3.00),
        is_snap_to_chapter INTEGER NOT NULL DEFAULT 1 CHECK (is_snap_to_chapter IN (0, 1)),
        is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_history_scrubber_lookup ON history_scrubber_profiles(series_id);
    `);

    app = Fastify();
    await app.register(historyScrubberRoutes, {
      db,
      historyScrubberService: new HistoryScrubberService(db),
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('GET /api/v1/reader/history-scrubber/presets returns presets', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/history-scrubber/presets',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.presets.webtoon_continuous).toBeDefined();
    expect(body.presets.manga_rtl_continuous).toBeDefined();
    expect(body.presets.manga_ltr_continuous).toBeDefined();
  });

  it('GET /api/v1/reader/history-scrubber/profile/:seriesId returns default profile with ETag', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/history-scrubber/profile/one-piece',
    });
    expect(res.statusCode).toBe(200);
    const etag = res.headers['etag'];
    expect(etag).toBeDefined();
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.profile.seriesId).toBe('one-piece');
    expect(body.profile.scrubberMode).toBe('webtoon_continuous');

    // Test ETag 304 Not Modified
    const cachedRes = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/history-scrubber/profile/one-piece',
      headers: {
        'if-none-match': etag as string,
      },
    });
    expect(cachedRes.statusCode).toBe(304);
  });

  it('POST /api/v1/reader/history-scrubber/profile updates profile and returns updated entity', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/history-scrubber/profile',
      payload: {
        seriesId: 'one-piece',
        scrubberMode: 'manga_rtl_continuous',
        tapeThicknessPx: 56,
        heatmapIntensity: 0.75,
        velocityMultiplier: 1.4,
        isSnapToChapter: true,
        isEnabled: true,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.profile.seriesId).toBe('one-piece');
    expect(body.profile.scrubberMode).toBe('manga_rtl_continuous');
    expect(body.profile.tapeThicknessPx).toBe(56);
  });

  it('POST /api/v1/reader/history-scrubber/project-tape projects tape positions accurately', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/history-scrubber/project-tape',
      payload: {
        totalItems: 100,
        currentIndex: 25,
        tapeLengthPx: 1000,
        mode: 'webtoon_continuous',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.result.clampedIndex).toBe(25);
    expect(body.result.pixelOffset).toBeGreaterThan(0);
  });

  it('returns 400 when missing seriesId parameter', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/history-scrubber/profile',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });
});
