import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import { balloonTailRoutes } from '../../../../src/backend/routes/balloon-tail-routes.js';
import { BalloonTailService } from '../../../../src/backend/services/balloon-tail-service.js';

describe('Sprint 116 - Balloon Tail Routes', () => {
  let db: DatabaseInstance;
  let app: FastifyInstance;
  let service: BalloonTailService;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS balloon_tail_profiles (
        series_id TEXT PRIMARY KEY,
        tail_style TEXT NOT NULL DEFAULT 'manga_compact' CHECK (tail_style IN (
          'manga_compact',
          'expressive_curve',
          'manhwa_clean',
          'whisper_subtle',
          'shout_dynamic'
        )),
        balloon_shape TEXT NOT NULL DEFAULT 'ellipse' CHECK (balloon_shape IN ('ellipse', 'rounded_rect', 'polygon_shout')),
        root_width_px REAL NOT NULL DEFAULT 14.0 CHECK (root_width_px >= 6.0 AND root_width_px <= 32.0),
        curvature_factor REAL NOT NULL DEFAULT 0.15 CHECK (curvature_factor >= 0.0 AND curvature_factor <= 0.50),
        tip_offset_px REAL NOT NULL DEFAULT 4.0 CHECK (tip_offset_px >= 0.0 AND tip_offset_px <= 20.0),
        is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_balloon_tail_lookup ON balloon_tail_profiles(series_id);
    `);

    service = new BalloonTailService(db);
    app = Fastify({ logger: false });
    await app.register(balloonTailRoutes, {
      db,
      balloonTailService: service,
    });
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

  it('GET /api/v1/reader/balloon-tail/presets returns all predefined tail presets', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/balloon-tail/presets',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.presets.manga_compact).toBeDefined();
    expect(body.presets.expressive_curve).toBeDefined();
  });

  it('GET /api/v1/reader/balloon-tail/profile/:seriesId returns default profile', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/balloon-tail/profile/series-tail-route-1',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.profile.tailStyle).toBe('manga_compact');
    expect(body.profile.rootWidthPx).toBe(14.0);
    expect(res.headers.etag).toBeDefined();
  });

  it('GET /api/v1/reader/balloon-tail/profile/:seriesId returns 304 with matching ETag', async () => {
    const firstRes = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/balloon-tail/profile/series-tail-etag-1',
    });
    const etag = firstRes.headers.etag as string;

    const secondRes = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/balloon-tail/profile/series-tail-etag-1',
      headers: {
        'if-none-match': etag,
      },
    });

    expect(secondRes.statusCode).toBe(304);
  });

  it('POST /api/v1/reader/balloon-tail/profile saves updated profile', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/balloon-tail/profile',
      payload: {
        seriesId: 'series-post-tail-1',
        tailStyle: 'manhwa_clean',
        balloonShape: 'rounded_rect',
        rootWidthPx: 16.0,
        curvatureFactor: 0.2,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.profile.tailStyle).toBe('manhwa_clean');
    expect(body.profile.balloonShape).toBe('rounded_rect');
  });

  it('POST /api/v1/reader/balloon-tail/calculate calculates real-time tail vector geometry', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/balloon-tail/calculate',
      payload: {
        balloonCenterX: 200,
        balloonCenterY: 150,
        radiusX: 75,
        radiusY: 45,
        targetAnchorX: 300,
        targetAnchorY: 280,
        tailStyle: 'manga_compact',
        isEnabled: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.result.svgPathD).toContain('M ');
    expect(body.result.angleDeg).toBeGreaterThan(0);
    expect(body.result.lengthPx).toBeGreaterThan(0);
  });
});
