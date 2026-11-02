/**
 * KuraScroll Sprint 103: Ink Bleed Routes Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import { inkBleedRoutes, computeInkBleedEtag } from '../../../../src/backend/routes/ink-bleed-routes.js';
import { InkBleedService } from '../../../../src/backend/services/ink-bleed-service.js';

describe('inkBleedRoutes', () => {
  let app: FastifyInstance;
  let db: DatabaseInstance;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS ink_bleed_profiles (
        series_id TEXT PRIMARY KEY,
        compensation_mode TEXT NOT NULL DEFAULT 'vintage_newsprint' CHECK (compensation_mode IN (
            'vintage_newsprint',
            'deep_black_preservation',
            'halftone_clarity',
            'custom'
        )),
        black_point_lift REAL NOT NULL DEFAULT 0.08 CHECK (black_point_lift >= 0.00 AND black_point_lift <= 0.30),
        white_point_compression REAL NOT NULL DEFAULT 0.95 CHECK (white_point_compression >= 0.70 AND white_point_compression <= 1.00),
        gamma_exponent REAL NOT NULL DEFAULT 1.15 CHECK (gamma_exponent >= 0.50 AND gamma_exponent <= 2.50),
        ink_bleed_threshold REAL NOT NULL DEFAULT 0.18 CHECK (ink_bleed_threshold >= 0.05 AND ink_bleed_threshold <= 0.50),
        is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_ink_bleed_lookup ON ink_bleed_profiles(series_id);
    `);

    app = Fastify();
    await app.register(inkBleedRoutes, {
      db,
      inkBleedService: new InkBleedService(db),
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('GET /api/v1/reader/ink-bleed/presets returns 200 with presets', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/ink-bleed/presets',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.presets.vintage_newsprint).toBeDefined();
    expect(body.presets.deep_black_preservation).toBeDefined();
    expect(body.presets.halftone_clarity).toBeDefined();
    expect(body.presets.custom).toBeDefined();
  });

  it('GET /api/v1/reader/ink-bleed/profile/:seriesId returns default profile and ETag header', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/ink-bleed/profile/s103-test',
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['etag']).toBeDefined();
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.profile.seriesId).toBe('s103-test');
    expect(body.profile.compensationMode).toBe('vintage_newsprint');
  });

  it('GET /api/v1/reader/ink-bleed/profile/:seriesId returns 304 when matching ETag is provided', async () => {
    const initialRes = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/ink-bleed/profile/s103-test',
    });
    const etag = initialRes.headers['etag'] as string;

    const cachedRes = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/ink-bleed/profile/s103-test',
      headers: {
        'if-none-match': etag,
      },
    });
    expect(cachedRes.statusCode).toBe(304);
  });

  it('POST /api/v1/reader/ink-bleed/profile updates profile and returns 200', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/ink-bleed/profile',
      payload: {
        seriesId: 's103-updated',
        compensationMode: 'halftone_clarity',
        blackPointLift: 0.12,
        whitePointCompression: 0.92,
        gammaExponent: 1.25,
        inkBleedThreshold: 0.25,
        isEnabled: true,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.profile.compensationMode).toBe('halftone_clarity');
    expect(body.profile.blackPointLift).toBe(0.12);
  });

  it('POST /api/v1/reader/ink-bleed/profile returns 400 for empty seriesId', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/ink-bleed/profile',
      payload: {
        seriesId: '',
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /api/v1/reader/ink-bleed/calculate-compensation calculates compensation parameters', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/ink-bleed/calculate-compensation',
      payload: {
        blackPointLift: 0.08,
        whitePointCompression: 0.95,
        gammaExponent: 1.15,
        inkBleedThreshold: 0.18,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.result.contrastMultiplier).toBe(87);
    expect(body.result.cssFilterString).toContain('contrast');
    expect(body.result.latencyUs).toBeLessThan(500);
  });
});
