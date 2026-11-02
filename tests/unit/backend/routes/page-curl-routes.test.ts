/**
 * KuraScroll Sprint 93: Page Curl Routes Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import { pageCurlRoutes, computePageCurlEtag } from '../../../../src/backend/routes/page-curl-routes.js';
import { PageCurlService } from '../../../../src/backend/services/page-curl-service.js';

describe('pageCurlRoutes', () => {
  let app: FastifyInstance;
  let db: DatabaseInstance;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS page_curl_profiles (
        series_id TEXT PRIMARY KEY,
        curl_preset TEXT NOT NULL DEFAULT 'tankobon_stiff' CHECK (curl_preset IN (
            'tankobon_stiff',
            'doujin_silk',
            'newsprint_pulp',
            'custom'
        )),
        paper_stiffness REAL NOT NULL DEFAULT 0.85 CHECK (paper_stiffness >= 0.20 AND paper_stiffness <= 1.00),
        max_curl_angle_deg REAL NOT NULL DEFAULT 45.0 CHECK (max_curl_angle_deg >= 15.0 AND max_curl_angle_deg <= 85.0),
        shadow_depth REAL NOT NULL DEFAULT 0.40 CHECK (shadow_depth >= 0.00 AND shadow_depth <= 1.00),
        is_peel_corner_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_peel_corner_enabled IN (0, 1)),
        is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_page_curl_lookup ON page_curl_profiles(series_id);
    `);

    app = Fastify();
    await app.register(pageCurlRoutes, {
      db,
      pageCurlService: new PageCurlService(db),
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('GET /api/v1/reader/page-curl/presets returns presets', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/page-curl/presets',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.presets.tankobon_stiff).toBeDefined();
    expect(body.presets.doujin_silk).toBeDefined();
    expect(body.presets.newsprint_pulp).toBeDefined();
    expect(body.presets.custom).toBeDefined();
  });

  it('GET /api/v1/reader/page-curl/profile/:seriesId returns default profile with ETag', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/page-curl/profile/slam-dunk',
    });
    expect(res.statusCode).toBe(200);
    const etag = res.headers['etag'];
    expect(etag).toBeDefined();
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.profile.seriesId).toBe('slam-dunk');
    expect(body.profile.curlPreset).toBe('tankobon_stiff');
  });

  it('GET /api/v1/reader/page-curl/profile/:seriesId returns 304 on matching ETag', async () => {
    const firstRes = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/page-curl/profile/slam-dunk',
    });
    const etag = firstRes.headers['etag'] as string;

    const secondRes = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/page-curl/profile/slam-dunk',
      headers: {
        'if-none-match': etag,
      },
    });
    expect(secondRes.statusCode).toBe(304);
  });

  it('POST /api/v1/reader/page-curl/profile upserts and returns modified profile', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/page-curl/profile',
      payload: {
        seriesId: 'slam-dunk',
        curlPreset: 'doujin_silk',
        paperStiffness: 0.60,
        maxCurlAngleDeg: 75.0,
        shadowDepth: 0.55,
        isPeelCornerEnabled: false,
        isEnabled: true,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.profile.curlPreset).toBe('doujin_silk');
    expect(body.profile.paperStiffness).toBe(0.60);
    expect(body.profile.isPeelCornerEnabled).toBe(false);

    const getRes = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/page-curl/profile/slam-dunk',
    });
    expect(getRes.json().profile.curlPreset).toBe('doujin_silk');
  });

  it('POST /api/v1/reader/page-curl/calculate-transform returns 2.5D kinematics', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/page-curl/calculate-transform',
      payload: {
        dragProgress: 0.45,
        velocityPx: 120,
        stiffness: 0.85,
        maxAngleDeg: 45.0,
        shadowDepth: 0.40,
        isCornerPeel: true,
        isRtl: true,
        preset: 'tankobon_stiff',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.result.dragProgress).toBe(0.45);
    expect(body.result.transformMatrixCss).toContain('perspective(1000px)');
    expect(body.result.spineShadowCss).toBeDefined();
  });

  it('POST /api/v1/reader/page-curl/profile rejects empty seriesId', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/page-curl/profile',
      payload: {
        seriesId: '   ',
      },
    });
    expect(res.statusCode).toBe(400);
  });
});
