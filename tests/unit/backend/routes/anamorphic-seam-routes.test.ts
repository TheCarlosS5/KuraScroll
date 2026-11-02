import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import { anamorphicSeamRoutes } from '../../../../src/backend/routes/anamorphic-seam-routes.js';
import { AnamorphicSeamService } from '../../../../src/backend/services/anamorphic-seam-service.js';

describe('Sprint 111 - Anamorphic Seam Routes', () => {
  let db: DatabaseInstance;
  let app: FastifyInstance;
  let service: AnamorphicSeamService;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS anamorphic_seam_profiles (
        series_id TEXT PRIMARY KEY,
        aspect_ratio_mode TEXT NOT NULL DEFAULT 'native' CHECK (aspect_ratio_mode IN (
            'native',
            'anamorphic_4_3_to_16_9',
            'anamorphic_4_3_to_16_10',
            'custom_unsqueeze'
        )),
        unsqueeze_factor REAL NOT NULL DEFAULT 1.0 CHECK (unsqueeze_factor >= 0.70 AND unsqueeze_factor <= 1.50),
        seam_overlap_px REAL NOT NULL DEFAULT 0.75 CHECK (seam_overlap_px >= 0.0 AND seam_overlap_px <= 2.0),
        subpixel_snapping_mode TEXT NOT NULL DEFAULT 'cumulative_origin' CHECK (subpixel_snapping_mode IN (
            'cumulative_origin',
            'round',
            'floor',
            'ceil'
        )),
        is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_anamorphic_seam_lookup ON anamorphic_seam_profiles(series_id);
    `);

    service = new AnamorphicSeamService(db);
    app = Fastify({ logger: false });
    await app.register(anamorphicSeamRoutes, { db, anamorphicSeamService: service });
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

  it('GET /api/v1/reader/anamorphic-seam/profile/:seriesId returns default profile', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/anamorphic-seam/profile/series-seam-1',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.profile.seriesId).toBe('series-seam-1');
    expect(body.profile.aspectRatioMode).toBe('native');
    expect(body.profile.unsqueezeFactor).toBe(1.0);
    expect(res.headers.etag).toBeDefined();
  });

  it('GET /api/v1/reader/anamorphic-seam/profile/:seriesId supports ETag 304', async () => {
    const initial = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/anamorphic-seam/profile/series-etag',
    });
    const etag = initial.headers.etag;

    const cached = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/anamorphic-seam/profile/series-etag',
      headers: { 'if-none-match': etag },
    });

    expect(cached.statusCode).toBe(304);
  });

  it('POST /api/v1/reader/anamorphic-seam/profile updates profile and validates', async () => {
    const postRes = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/anamorphic-seam/profile',
      payload: {
        seriesId: 'series-seam-1',
        aspectRatioMode: 'anamorphic_4_3_to_16_9',
        unsqueezeFactor: 1.3333,
        seamOverlapPx: 1.0,
      },
    });

    expect(postRes.statusCode).toBe(200);
    const postBody = JSON.parse(postRes.payload);
    expect(postBody.success).toBe(true);
    expect(postBody.profile.aspectRatioMode).toBe('anamorphic_4_3_to_16_9');

    const getRes = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/anamorphic-seam/profile/series-seam-1',
    });
    const getBody = JSON.parse(getRes.payload);
    expect(getBody.profile.aspectRatioMode).toBe('anamorphic_4_3_to_16_9');
    expect(getBody.profile.seamOverlapPx).toBe(1.0);
  });

  it('POST /api/v1/reader/anamorphic-seam/calculate computes slice seam transformation', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/anamorphic-seam/calculate',
      payload: {
        sliceIndex: 0,
        rawStartY: 0,
        rawHeight: 1200,
        aspectRatioMode: 'anamorphic_4_3_to_16_9',
        unsqueezeFactor: 1.3333,
        seamOverlapPx: 0.75,
        subpixelSnappingMode: 'cumulative_origin',
        isEnabled: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.result.aspectRatioMode).toBe('anamorphic_4_3_to_16_9');
    expect(body.result.unsqueezeFactor).toBe(1.3333);
    expect(body.result.renderedHeight).toBe(1600);
    expect(body.result.transformCss).toBe('scaleY(1.3333)');
    expect(body.result.marginBottomCss).toBe('-0.75px');
  });

  it('GET /api/v1/reader/anamorphic-seam/presets returns predefined aspect ratio presets', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/anamorphic-seam/presets',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.presets.native).toBeDefined();
    expect(body.presets.anamorphic_4_3_to_16_9).toBeDefined();
    expect(body.presets.anamorphic_4_3_to_16_10).toBeDefined();
  });
});
