/**
 * KuraScroll Sprint 96: Crease Shadow Routes Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import { creaseShadowRoutes, computeCreaseShadowEtag } from '../../../../src/backend/routes/crease-shadow-routes.js';
import { CreaseShadowService } from '../../../../src/backend/services/crease-shadow-service.js';

describe('creaseShadowRoutes', () => {
  let app: FastifyInstance;
  let db: DatabaseInstance;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS crease_shadow_profiles (
        series_id TEXT PRIMARY KEY,
        spread_binding_mode TEXT NOT NULL DEFAULT 'tankobon_tight' CHECK (spread_binding_mode IN (
            'tankobon_tight',
            'magazine_wide',
            'flat_lay',
            'custom'
        )),
        spine_shadow_intensity REAL NOT NULL DEFAULT 0.65 CHECK (spine_shadow_intensity >= 0.00 AND spine_shadow_intensity <= 1.00),
        gutter_width_px INTEGER NOT NULL DEFAULT 24 CHECK (gutter_width_px >= 8 AND gutter_width_px <= 64),
        asymmetry_ratio REAL NOT NULL DEFAULT 0.50 CHECK (asymmetry_ratio >= 0.00 AND asymmetry_ratio <= 1.00),
        is_rtl INTEGER NOT NULL DEFAULT 1 CHECK (is_rtl IN (0, 1)),
        is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_crease_shadow_lookup ON crease_shadow_profiles(series_id);
    `);

    app = Fastify();
    await app.register(creaseShadowRoutes, {
      db,
      creaseShadowService: new CreaseShadowService(db),
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('GET /api/v1/reader/crease-shadow/presets returns presets', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/crease-shadow/presets',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.presets.tankobon_tight).toBeDefined();
    expect(body.presets.magazine_wide).toBeDefined();
    expect(body.presets.flat_lay).toBeDefined();
    expect(body.presets.custom).toBeDefined();
  });

  it('GET /api/v1/reader/crease-shadow/profile/:seriesId returns default profile with ETag', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/crease-shadow/profile/berserk-volume',
    });
    expect(res.statusCode).toBe(200);
    const etag = res.headers['etag'];
    expect(etag).toBeDefined();
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.profile.seriesId).toBe('berserk-volume');
    expect(body.profile.spreadBindingMode).toBe('tankobon_tight');
  });

  it('GET /api/v1/reader/crease-shadow/profile/:seriesId returns 304 on matching ETag', async () => {
    const firstRes = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/crease-shadow/profile/berserk-volume',
    });
    const etag = firstRes.headers['etag'] as string;

    const secondRes = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/crease-shadow/profile/berserk-volume',
      headers: {
        'if-none-match': etag,
      },
    });
    expect(secondRes.statusCode).toBe(304);
  });

  it('POST /api/v1/reader/crease-shadow/profile upserts and returns modified profile', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/crease-shadow/profile',
      payload: {
        seriesId: 'berserk-volume',
        spreadBindingMode: 'flat_lay',
        spineShadowIntensity: 0.20,
        gutterWidthPx: 12,
        asymmetryRatio: 0.30,
        isRtl: true,
        isEnabled: true,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.profile.spreadBindingMode).toBe('flat_lay');
    expect(body.profile.gutterWidthPx).toBe(12);

    const getRes = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/crease-shadow/profile/berserk-volume',
    });
    expect(getRes.json().profile.spreadBindingMode).toBe('flat_lay');
  });

  it('POST /api/v1/reader/crease-shadow/calculate-crease-shadow returns bilateral gradients', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/crease-shadow/calculate-crease-shadow',
      payload: {
        progressRatio: 0.25,
        intensity: 0.65,
        gutterWidthPx: 24,
        asymmetry: 0.50,
        isRtl: true,
        mode: 'tankobon_tight',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.result.leftPageShadowCss).toContain('linear-gradient(to left');
    expect(body.result.rightPageShadowCss).toContain('linear-gradient(to right');
    expect(body.result.spineCurvatureTransformCss).toContain('perspective(800px)');
  });

  it('POST /api/v1/reader/crease-shadow/profile rejects empty seriesId', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/crease-shadow/profile',
      payload: {
        seriesId: '',
      },
    });
    expect(res.statusCode).toBe(400);
  });
});
