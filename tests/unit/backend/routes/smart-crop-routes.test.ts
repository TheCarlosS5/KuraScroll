import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fastify, { FastifyInstance } from 'fastify';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import { smartCropRoutes } from '../../../../src/backend/routes/smart-crop-routes.js';
import { SmartCropService } from '../../../../src/backend/services/smart-crop-service.js';

describe('SmartCropRoutes (Sprint 84)', () => {
  let app: FastifyInstance;
  let db: DatabaseInstance;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS smart_crop_profiles (
        series_id TEXT PRIMARY KEY,
        mode TEXT NOT NULL DEFAULT 'dialogue_safe' CHECK (mode IN ('conservative', 'aggressive', 'dialogue_safe')),
        margin_threshold REAL NOT NULL DEFAULT 0.96 CHECK (margin_threshold >= 0.80 AND margin_threshold <= 0.99),
        aspect_ratio_lock INTEGER NOT NULL DEFAULT 0 CHECK (aspect_ratio_lock IN (0, 1)),
        target_aspect_ratio REAL NOT NULL DEFAULT 0.70 CHECK (target_aspect_ratio >= 0.40 AND target_aspect_ratio <= 2.0),
        padding_px INTEGER NOT NULL DEFAULT 12 CHECK (padding_px >= 0 AND padding_px <= 64),
        is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
        updated_at INTEGER NOT NULL
      );
    `);

    app = fastify();
    await app.register(smartCropRoutes, {
      db,
      smartCropService: new SmartCropService(db),
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('GET /api/v1/reader/smart-crop/modes returns supported crop modes', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/smart-crop/modes',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.modes).toHaveProperty('dialogue_safe');
    expect(body.modes).toHaveProperty('conservative');
    expect(body.modes).toHaveProperty('aggressive');
  });

  it('GET /api/v1/reader/smart-crop/profile/:seriesId returns profile with ETag', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/smart-crop/profile/series-crop-test',
    });

    expect(res.statusCode).toBe(200);
    const etag = res.headers['etag'];
    expect(etag).toBeDefined();

    // Re-request with If-None-Match to verify 304 Not Modified
    const cachedRes = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/smart-crop/profile/series-crop-test',
      headers: {
        'if-none-match': etag as string,
      },
    });

    expect(cachedRes.statusCode).toBe(304);
  });

  it('POST /api/v1/reader/smart-crop/profile validates and saves profile', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/smart-crop/profile',
      payload: {
        seriesId: 'series-vagabond',
        mode: 'conservative',
        marginThreshold: 0.94,
        aspectRatioLock: true,
        targetAspectRatio: 0.72,
        paddingPx: 16,
        isEnabled: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.profile.seriesId).toBe('series-vagabond');
    expect(body.profile.mode).toBe('conservative');
    expect(body.profile.paddingPx).toBe(16);
  });

  it('POST /api/v1/reader/smart-crop/calculate-crop returns valid bounding box result', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/smart-crop/calculate-crop',
      payload: {
        pageWidth: 1000,
        pageHeight: 1500,
        contentBounds: { minX: 0.1, minY: 0.08, maxX: 0.9, maxY: 0.92 },
        mode: 'dialogue_safe',
        paddingPx: 12,
        lockAspectRatio: false,
        targetRatio: 0.70,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.cropResult).toBeDefined();
    expect(body.cropResult.isCropped).toBe(true);
    expect(body.cropResult.marginSavedPct).toBeGreaterThan(0);
  });

  it('rejects requests with missing seriesId with 400 Bad Request', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/smart-crop/profile',
      payload: {
        mode: 'aggressive',
      },
    });

    expect(res.statusCode).toBe(400);
  });
});
