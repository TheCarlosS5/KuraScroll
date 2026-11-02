/**
 * KuraScroll Sprint 88: Saccadic Motion Trajectory Smoothing & Dynamic Inertial Scroller Routes Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import { inertialScrollRoutes } from '../../../../src/backend/routes/inertial-scroll-routes.js';
import { InertialScrollService } from '../../../../src/backend/services/inertial-scroll-service.js';

describe('inertialScrollRoutes', () => {
  let app: FastifyInstance;
  let db: DatabaseInstance;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS inertial_scroll_profiles (
        series_id TEXT PRIMARY KEY,
        friction_coefficient REAL NOT NULL DEFAULT 0.92 CHECK (friction_coefficient >= 0.70 AND friction_coefficient <= 0.99),
        mass REAL NOT NULL DEFAULT 1.0 CHECK (mass >= 0.2 AND mass <= 5.0),
        spring_tension REAL NOT NULL DEFAULT 120.0 CHECK (spring_tension >= 10.0 AND spring_tension <= 500.0),
        velocity_clamp_px REAL NOT NULL DEFAULT 3500.0 CHECK (velocity_clamp_px >= 500.0 AND velocity_clamp_px <= 10000.0),
        is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_inertial_scroll_lookup ON inertial_scroll_profiles(series_id);
    `);

    app = Fastify();
    await app.register(inertialScrollRoutes, {
      db,
      inertialScrollService: new InertialScrollService(db),
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('GET /api/v1/reader/inertial-scroll/presets returns presets', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/inertial-scroll/presets',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.presets.smooth_glider).toBeDefined();
    expect(body.presets.natural_paper).toBeDefined();
    expect(body.presets.crisp_snap).toBeDefined();
  });

  it('GET /api/v1/reader/inertial-scroll/profile/:seriesId returns default profile with ETag', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/inertial-scroll/profile/tower-of-god',
    });
    expect(res.statusCode).toBe(200);
    const etag = res.headers['etag'];
    expect(etag).toBeDefined();
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.profile.seriesId).toBe('tower-of-god');
    expect(body.profile.frictionCoefficient).toBe(0.90);

    // Test ETag 304 Not Modified
    const cachedRes = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/inertial-scroll/profile/tower-of-god',
      headers: {
        'if-none-match': etag as string,
      },
    });
    expect(cachedRes.statusCode).toBe(304);
  });

  it('POST /api/v1/reader/inertial-scroll/profile updates profile and returns updated entity', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/inertial-scroll/profile',
      payload: {
        seriesId: 'wind-breaker-webtoon',
        frictionCoefficient: 0.94,
        mass: 1.1,
        springTension: 110.0,
        velocityClampPx: 4000.0,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.profile.seriesId).toBe('wind-breaker-webtoon');
    expect(body.profile.frictionCoefficient).toBe(0.94);
    expect(body.profile.springTension).toBe(110.0);
  });

  it('POST /api/v1/reader/inertial-scroll/calculate-step calculates step correctly', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/inertial-scroll/calculate-step',
      payload: {
        currentPos: 0,
        targetPos: 100,
        velocity: 0,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.result.nextPosition).toBeGreaterThan(0);
    expect(body.result.nextVelocity).toBeGreaterThan(0);
    expect(body.result.isResting).toBe(false);
  });

  it('returns 400 when missing required parameters', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/inertial-scroll/calculate-step',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });
});
