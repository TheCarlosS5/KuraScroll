/**
 * KuraScroll Sprint 105: Chapter Seam Routes Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import { chapterSeamRoutes, computeChapterSeamEtag } from '../../../../src/backend/routes/chapter-seam-routes.js';
import { ChapterSeamService } from '../../../../src/backend/services/chapter-seam-service.js';

describe('chapterSeamRoutes', () => {
  let app: FastifyInstance;
  let db: DatabaseInstance;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS chapter_seam_profiles (
        series_id TEXT PRIMARY KEY,
        deceleration_mode TEXT NOT NULL DEFAULT 'smooth_continuous' CHECK (deceleration_mode IN (
            'smooth_continuous',
            'tactile_snap',
            'rapid_glide',
            'disabled',
            'custom'
        )),
        seam_threshold_px INTEGER NOT NULL DEFAULT 160 CHECK (seam_threshold_px >= 32 AND seam_threshold_px <= 600),
        damping_factor REAL NOT NULL DEFAULT 0.85 CHECK (damping_factor >= 0.10 AND damping_factor <= 0.99),
        pre_bake_panels INTEGER NOT NULL DEFAULT 4 CHECK (pre_bake_panels >= 1 AND pre_bake_panels <= 12),
        is_magnetic_snap INTEGER NOT NULL DEFAULT 1 CHECK (is_magnetic_snap IN (0, 1)),
        is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_chapter_seam_lookup ON chapter_seam_profiles(series_id);
    `);

    app = Fastify();
    await app.register(chapterSeamRoutes, {
      db,
      chapterSeamService: new ChapterSeamService(db),
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('GET /api/v1/reader/chapter-seam/presets returns 200 with presets', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/chapter-seam/presets',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.presets)).toBe(true);
    expect(body.presets.length).toBeGreaterThanOrEqual(4);
  });

  it('GET /api/v1/reader/chapter-seam/profile/:seriesId returns default profile and ETag header', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/chapter-seam/profile/s105-test',
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['etag']).toBeDefined();
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.profile.seriesId).toBe('s105-test');
    expect(body.profile.decelerationMode).toBe('smooth_continuous');
    expect(body.profile.seamThresholdPx).toBe(160);
  });

  it('GET /api/v1/reader/chapter-seam/profile/:seriesId returns 304 when matching ETag is provided', async () => {
    const initialRes = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/chapter-seam/profile/s105-test',
    });
    expect(initialRes.statusCode).toBe(200);
    const etag = initialRes.headers['etag'] as string;

    const cachedRes = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/chapter-seam/profile/s105-test',
      headers: {
        'if-none-match': etag,
      },
    });
    expect(cachedRes.statusCode).toBe(304);
  });

  it('POST /api/v1/reader/chapter-seam/profile upserts and modifies profile', async () => {
    const postRes = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/chapter-seam/profile',
      payload: {
        seriesId: 's105-saved',
        decelerationMode: 'tactile_snap',
        seamThresholdPx: 240,
        dampingFactor: 0.92,
        preBakePanels: 2,
        isMagneticSnap: true,
      },
    });

    expect(postRes.statusCode).toBe(200);
    const postBody = postRes.json();
    expect(postBody.success).toBe(true);
    expect(postBody.profile.decelerationMode).toBe('tactile_snap');
    expect(postBody.profile.seamThresholdPx).toBe(240);

    const getRes = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/chapter-seam/profile/s105-saved',
    });
    expect(getRes.statusCode).toBe(200);
    expect(getRes.json().profile.decelerationMode).toBe('tactile_snap');
  });

  it('POST /api/v1/reader/chapter-seam/calculate computes kinematics', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/chapter-seam/calculate',
      payload: {
        currentVelocity: 1000,
        distanceToSeamPx: 80,
        seamThresholdPx: 160,
        dampingFactor: 0.85,
        preBakePanels: 4,
        isMagneticSnap: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.result.adjustedVelocity).toBeLessThan(1000);
    expect(body.result.seamResistancePct).toBeGreaterThan(0);
    expect(body.result.isPreBakeActive).toBe(true);
    expect(body.result.latencyUs).toBeLessThan(10000);
  });

  it('POST /api/v1/reader/chapter-seam/profile returns 400 on empty seriesId', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/chapter-seam/profile',
      payload: { seriesId: '' },
    });
    expect(res.statusCode).toBe(400);
  });
});
