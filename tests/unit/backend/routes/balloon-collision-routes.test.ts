/**
 * KuraScroll Sprint 102: Balloon Collision Routes Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import { balloonCollisionRoutes, computeBalloonCollisionEtag } from '../../../../src/backend/routes/balloon-collision-routes.js';
import { BalloonCollisionService } from '../../../../src/backend/services/balloon-collision-service.js';

describe('balloonCollisionRoutes', () => {
  let app: FastifyInstance;
  let db: DatabaseInstance;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS balloon_collision_profiles (
        series_id TEXT PRIMARY KEY,
        avoidance_strategy TEXT NOT NULL DEFAULT 'minimal_euclidean' CHECK (avoidance_strategy IN (
            'minimal_euclidean',
            'reading_gravity_downward',
            'opposite_margin',
            'clamp_only'
        )),
        safety_margin_px INTEGER NOT NULL DEFAULT 12 CHECK (safety_margin_px >= 0 AND safety_margin_px <= 64),
        max_displacement_px INTEGER NOT NULL DEFAULT 120 CHECK (max_displacement_px >= 20 AND max_displacement_px <= 400),
        prefer_vertical_shift INTEGER NOT NULL DEFAULT 1 CHECK (prefer_vertical_shift IN (0, 1)),
        is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_balloon_collision_lookup ON balloon_collision_profiles(series_id);
    `);

    app = Fastify();
    await app.register(balloonCollisionRoutes, {
      db,
      balloonCollisionService: new BalloonCollisionService(db),
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('GET /api/v1/reader/balloon-collision/presets returns 200 with presets', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/balloon-collision/presets',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.presets.minimal_euclidean).toBeDefined();
    expect(body.presets.reading_gravity_downward).toBeDefined();
    expect(body.presets.opposite_margin).toBeDefined();
    expect(body.presets.clamp_only).toBeDefined();
  });

  it('GET /api/v1/reader/balloon-collision/profile/:seriesId returns default profile and ETag header', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/balloon-collision/profile/s102-test',
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['etag']).toBeDefined();
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.profile.seriesId).toBe('s102-test');
    expect(body.profile.avoidanceStrategy).toBe('minimal_euclidean');
  });

  it('GET /api/v1/reader/balloon-collision/profile/:seriesId returns 304 when matching ETag is provided', async () => {
    const initialRes = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/balloon-collision/profile/s102-test',
    });
    const etag = initialRes.headers['etag'] as string;

    const cachedRes = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/balloon-collision/profile/s102-test',
      headers: {
        'if-none-match': etag,
      },
    });
    expect(cachedRes.statusCode).toBe(304);
  });

  it('POST /api/v1/reader/balloon-collision/profile updates profile and returns 200', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/balloon-collision/profile',
      payload: {
        seriesId: 's102-updated',
        avoidanceStrategy: 'reading_gravity_downward',
        safetyMarginPx: 16,
        maxDisplacementPx: 180,
        preferVerticalShift: true,
        isEnabled: true,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.profile.avoidanceStrategy).toBe('reading_gravity_downward');
    expect(body.profile.safetyMarginPx).toBe(16);
  });

  it('POST /api/v1/reader/balloon-collision/profile returns 400 for empty seriesId', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/balloon-collision/profile',
      payload: {
        seriesId: '',
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /api/v1/reader/balloon-collision/calculate-avoidance calculates avoidance result', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/balloon-collision/calculate-avoidance',
      payload: {
        overlayBox: { x: 200, y: 200, width: 100, height: 60 },
        balloonBoxes: [{ x: 180, y: 180, width: 140, height: 100 }],
        strategy: 'minimal_euclidean',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.result.hasCollision).toBe(true);
    expect(body.result.displacedBox).toBeDefined();
    expect(body.result.latencyUs).toBeLessThan(500);
  });

  it('POST /api/v1/reader/balloon-collision/calculate-avoidance returns 400 when missing overlayBox', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/balloon-collision/calculate-avoidance',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });
});
