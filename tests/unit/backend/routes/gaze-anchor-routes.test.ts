import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fastify, { FastifyInstance } from 'fastify';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import { gazeAnchorRoutes } from '../../../../src/backend/routes/gaze-anchor-routes.js';
import { GazeAnchorService } from '../../../../src/backend/services/gaze-anchor-service.js';

describe('GazeAnchorRoutes (Sprint 83)', () => {
  let app: FastifyInstance;
  let db: DatabaseInstance;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS gaze_anchor_profiles (
        series_id TEXT PRIMARY KEY,
        mode TEXT NOT NULL DEFAULT 'manga_rtl' CHECK (mode IN ('webtoon', 'manga_rtl', 'manga_ltr')),
        saccade_sensitivity REAL NOT NULL DEFAULT 1.0 CHECK (saccade_sensitivity >= 0.1 AND saccade_sensitivity <= 3.0),
        dwell_threshold_ms INTEGER NOT NULL DEFAULT 250 CHECK (dwell_threshold_ms >= 50 AND dwell_threshold_ms <= 1000),
        drift_tolerance_px REAL NOT NULL DEFAULT 40.0 CHECK (drift_tolerance_px >= 10.0 AND drift_tolerance_px <= 200.0),
        return_anchor_enabled INTEGER NOT NULL DEFAULT 1 CHECK (return_anchor_enabled IN (0, 1)),
        heatmap_resolution TEXT NOT NULL DEFAULT 'medium' CHECK (heatmap_resolution IN ('low', 'medium', 'high')),
        updated_at INTEGER NOT NULL
      );
    `);

    app = fastify();
    await app.register(gazeAnchorRoutes, {
      db,
      gazeAnchorService: new GazeAnchorService(db),
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('GET /api/v1/reader/gaze-anchor/modes returns supported gaze modes', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/gaze-anchor/modes',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.modes).toHaveProperty('webtoon');
    expect(body.modes).toHaveProperty('manga_rtl');
    expect(body.modes).toHaveProperty('manga_ltr');
  });

  it('GET /api/v1/reader/gaze-anchor/profile/:seriesId returns profile with ETag', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/gaze-anchor/profile/series-test-123',
    });

    expect(res.statusCode).toBe(200);
    const etag = res.headers['etag'];
    expect(etag).toBeDefined();

    // Re-request with If-None-Match to verify 304 Not Modified
    const cachedRes = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/gaze-anchor/profile/series-test-123',
      headers: {
        'if-none-match': etag as string,
      },
    });

    expect(cachedRes.statusCode).toBe(304);
  });

  it('POST /api/v1/reader/gaze-anchor/profile validates and saves profile', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/gaze-anchor/profile',
      payload: {
        seriesId: 'series-solo',
        mode: 'webtoon',
        saccadeSensitivity: 1.8,
        dwellThresholdMs: 350,
        driftTolerancePx: 50.0,
        returnAnchorEnabled: true,
        heatmapResolution: 'high',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.profile.seriesId).toBe('series-solo');
    expect(body.profile.mode).toBe('webtoon');
    expect(body.profile.saccadeSensitivity).toBe(1.8);
  });

  it('POST /api/v1/reader/gaze-anchor/calculate-trajectory returns valid trajectory', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/gaze-anchor/calculate-trajectory',
      payload: {
        currentX: 200,
        currentY: 300,
        previousX: 195,
        previousY: 298,
        velocity: 0.2,
        mode: 'manga_rtl',
        dwellMs: 200,
        driftTolerancePx: 40.0,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.trajectory).toBeDefined();
    expect(body.trajectory.isDriftDetected).toBe(true);
  });

  it('rejects requests with missing seriesId with 400 Bad Request', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/gaze-anchor/profile',
      payload: {
        mode: 'webtoon',
      },
    });

    expect(res.statusCode).toBe(400);
  });
});
