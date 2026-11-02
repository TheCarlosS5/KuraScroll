/**
 * KuraScroll Sprint 95: Motion Stabilizer Routes Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import { motionStabilizerRoutes, computeMotionStabilizerEtag } from '../../../../src/backend/routes/motion-stabilizer-routes.js';
import { MotionStabilizerService } from '../../../../src/backend/services/motion-stabilizer-service.js';

describe('motionStabilizerRoutes', () => {
  let app: FastifyInstance;
  let db: DatabaseInstance;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS motion_stabilizer_profiles (
        series_id TEXT PRIMARY KEY,
        stabilizer_mode TEXT NOT NULL DEFAULT 'smooth_spring' CHECK (stabilizer_mode IN (
            'smooth_spring',
            'high_inertia_damping',
            'esports_raw',
            'custom'
        )),
        damping_coefficient REAL NOT NULL DEFAULT 0.75 CHECK (damping_coefficient >= 0.10 AND damping_coefficient <= 0.99),
        velocity_threshold_px REAL NOT NULL DEFAULT 350.0 CHECK (velocity_threshold_px >= 50.0 AND velocity_threshold_px <= 2000.0),
        contrast_boost_factor REAL NOT NULL DEFAULT 1.25 CHECK (contrast_boost_factor >= 1.00 AND contrast_boost_factor <= 2.00),
        is_anti_ghosting_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_anti_ghosting_enabled IN (0, 1)),
        is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_motion_stabilizer_lookup ON motion_stabilizer_profiles(series_id);
    `);

    app = Fastify();
    await app.register(motionStabilizerRoutes, {
      db,
      motionStabilizerService: new MotionStabilizerService(db),
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('GET /api/v1/reader/motion-stabilizer/presets returns presets', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/motion-stabilizer/presets',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.presets.smooth_spring).toBeDefined();
    expect(body.presets.high_inertia_damping).toBeDefined();
    expect(body.presets.esports_raw).toBeDefined();
    expect(body.presets.custom).toBeDefined();
  });

  it('GET /api/v1/reader/motion-stabilizer/profile/:seriesId returns default profile with ETag', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/motion-stabilizer/profile/tower-of-god',
    });
    expect(res.statusCode).toBe(200);
    const etag = res.headers['etag'];
    expect(etag).toBeDefined();
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.profile.seriesId).toBe('tower-of-god');
    expect(body.profile.stabilizerMode).toBe('smooth_spring');
  });

  it('GET /api/v1/reader/motion-stabilizer/profile/:seriesId returns 304 on matching ETag', async () => {
    const firstRes = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/motion-stabilizer/profile/tower-of-god',
    });
    const etag = firstRes.headers['etag'] as string;

    const secondRes = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/motion-stabilizer/profile/tower-of-god',
      headers: {
        'if-none-match': etag,
      },
    });
    expect(secondRes.statusCode).toBe(304);
  });

  it('POST /api/v1/reader/motion-stabilizer/profile upserts and returns modified profile', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/motion-stabilizer/profile',
      payload: {
        seriesId: 'tower-of-god',
        stabilizerMode: 'high_inertia_damping',
        dampingCoefficient: 0.88,
        velocityThresholdPx: 250.0,
        contrastBoostFactor: 1.40,
        isAntiGhostingEnabled: true,
        isEnabled: true,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.profile.stabilizerMode).toBe('high_inertia_damping');
    expect(body.profile.dampingCoefficient).toBe(0.88);

    const getRes = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/motion-stabilizer/profile/tower-of-god',
    });
    expect(getRes.json().profile.stabilizerMode).toBe('high_inertia_damping');
  });

  it('POST /api/v1/reader/motion-stabilizer/calculate-stabilizer-params returns kinematic damping', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/motion-stabilizer/calculate-stabilizer-params',
      payload: {
        rawVelocityPx: 500,
        prevVelocityPx: 200,
        deltaY: 30,
        damping: 0.75,
        thresholdPx: 350.0,
        contrastBoost: 1.25,
        isAntiGhosting: true,
        mode: 'smooth_spring',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.result.smoothedVelocityPx).toBe(275); // 200 * 0.75 + 500 * 0.25
    expect(body.result.motionDeblurFilterCss).toContain('contrast(');
  });

  it('POST /api/v1/reader/motion-stabilizer/profile rejects empty seriesId', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/motion-stabilizer/profile',
      payload: {
        seriesId: '  ',
      },
    });
    expect(res.statusCode).toBe(400);
  });
});
