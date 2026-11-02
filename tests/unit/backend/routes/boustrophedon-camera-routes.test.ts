import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import { boustrophedonCameraRoutes } from '../../../../src/backend/routes/boustrophedon-camera-routes.js';
import { BoustrophedonCameraService } from '../../../../src/backend/services/boustrophedon-camera-service.js';

describe('Sprint 114 - Boustrophedon Camera Routes', () => {
  let db: DatabaseInstance;
  let app: FastifyInstance;
  let service: BoustrophedonCameraService;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS boustrophedon_camera_profiles (
        series_id TEXT PRIMARY KEY,
        reading_flow TEXT NOT NULL DEFAULT 'manga_rtl_zigzag' CHECK (reading_flow IN (
          'manga_rtl_zigzag',
          'webtoon_vertical',
          'comic_ltr_zigzag',
          'cinematic_freeflow'
        )),
        transition_easing TEXT NOT NULL DEFAULT 'cubic_bezier_cinematic' CHECK (transition_easing IN (
          'cubic_bezier_cinematic',
          'ease_in_out',
          'snappy_linear',
          'dramatic_punch'
        )),
        climax_zoom_multiplier REAL NOT NULL DEFAULT 1.25 CHECK (climax_zoom_multiplier >= 1.0 AND climax_zoom_multiplier <= 1.50),
        pan_lead_in_pct INTEGER NOT NULL DEFAULT 15 CHECK (pan_lead_in_pct >= 0 AND pan_lead_in_pct <= 50),
        max_rotation_deg REAL NOT NULL DEFAULT 0.0 CHECK (max_rotation_deg >= -5.0 AND max_rotation_deg <= 5.0),
        is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_boustrophedon_camera_lookup ON boustrophedon_camera_profiles(series_id);
    `);

    service = new BoustrophedonCameraService(db);
    app = Fastify({ logger: false });
    await app.register(boustrophedonCameraRoutes, {
      db,
      boustrophedonCameraService: service,
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

  it('GET /api/v1/reader/boustrophedon-camera/profile/:seriesId returns default profile', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/boustrophedon-camera/profile/series-default-1',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.profile.seriesId).toBe('series-default-1');
    expect(body.profile.readingFlow).toBe('manga_rtl_zigzag');
    expect(body.profile.transitionEasing).toBe('cubic_bezier_cinematic');
    expect(res.headers.etag).toBeDefined();
  });

  it('GET /api/v1/reader/boustrophedon-camera/profile/:seriesId returns 304 with matching ETag', async () => {
    const firstRes = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/boustrophedon-camera/profile/series-etag-1',
    });
    const etag = firstRes.headers.etag as string;

    const secondRes = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/boustrophedon-camera/profile/series-etag-1',
      headers: {
        'if-none-match': etag,
      },
    });

    expect(secondRes.statusCode).toBe(304);
  });

  it('POST /api/v1/reader/boustrophedon-camera/profile updates profile settings', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/boustrophedon-camera/profile',
      payload: {
        seriesId: 'series-post-1',
        readingFlow: 'comic_ltr_zigzag',
        transitionEasing: 'dramatic_punch',
        climaxZoomMultiplier: 1.35,
        panLeadInPct: 25,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.profile.readingFlow).toBe('comic_ltr_zigzag');
    expect(body.profile.transitionEasing).toBe('dramatic_punch');
    expect(body.profile.climaxZoomMultiplier).toBe(1.35);
    expect(body.profile.panLeadInPct).toBe(25);
  });

  it('POST /api/v1/reader/boustrophedon-camera/plan-trajectory calculates bezier polynomial coefficients', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/boustrophedon-camera/plan-trajectory',
      payload: {
        panelA: { x: 100, y: 100, width: 300, height: 200 },
        panelB: { x: 500, y: 700, width: 400, height: 300, isClimax: true },
        profile: {
          readingFlow: 'webtoon_vertical',
          transitionEasing: 'cubic_bezier_cinematic',
          climaxZoomMultiplier: 1.3,
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.plan.ax).toBeDefined();
    expect(body.plan.ay).toBeDefined();
    expect(body.plan.zoomTo).toBe(1.3);
    expect(body.plan.flow).toBe('webtoon_vertical');
  });

  it('POST /api/v1/reader/boustrophedon-camera/evaluate calculates camera state at progress t', async () => {
    const planRes = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/boustrophedon-camera/plan-trajectory',
      payload: {
        panelA: { x: 0, y: 0, width: 200, height: 200 },
        panelB: { x: 400, y: 400, width: 200, height: 200 },
      },
    });
    const plan = JSON.parse(planRes.body).plan;

    const evalRes = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/boustrophedon-camera/evaluate',
      payload: {
        trajectory: plan,
        progress: 0.5,
      },
    });

    expect(evalRes.statusCode).toBe(200);
    const evalBody = JSON.parse(evalRes.body);
    expect(evalBody.success).toBe(true);
    expect(evalBody.evaluatedState.x).toBeGreaterThan(100);
    expect(evalBody.evaluatedState.y).toBeGreaterThan(100);
  });
});
