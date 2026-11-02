/**
 * KuraScroll Sprint 99: Panel Pacing Routes Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import { panelPacingRoutes, computePanelPacingEtag } from '../../../../src/backend/routes/panel-pacing-routes.js';
import { PanelPacingService } from '../../../../src/backend/services/panel-pacing-service.js';

describe('panelPacingRoutes', () => {
  let app: FastifyInstance;
  let db: DatabaseInstance;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS panel_pacing_profiles (
        series_id TEXT PRIMARY KEY,
        pacing_mode TEXT NOT NULL DEFAULT 'cinematic_smooth' CHECK (pacing_mode IN (
            'cinematic_smooth',
            'dynamic_action',
            'instant_cut',
            'custom'
        )),
        transition_duration_ms INTEGER NOT NULL DEFAULT 280 CHECK (transition_duration_ms >= 100 AND transition_duration_ms <= 1000),
        zoom_overshoot_ratio REAL NOT NULL DEFAULT 1.05 CHECK (zoom_overshoot_ratio >= 1.00 AND zoom_overshoot_ratio <= 1.30),
        edge_padding_px INTEGER NOT NULL DEFAULT 16 CHECK (edge_padding_px >= 0 AND edge_padding_px <= 64),
        is_motion_reduced INTEGER NOT NULL DEFAULT 0 CHECK (is_motion_reduced IN (0, 1)),
        is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_panel_pacing_lookup ON panel_pacing_profiles(series_id);
    `);

    app = Fastify();
    await app.register(panelPacingRoutes, {
      db,
      panelPacingService: new PanelPacingService(db),
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('GET /api/v1/reader/panel-pacing/presets returns presets', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/panel-pacing/presets',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.presets.cinematic_smooth).toBeDefined();
    expect(body.presets.dynamic_action).toBeDefined();
    expect(body.presets.instant_cut).toBeDefined();
    expect(body.presets.custom).toBeDefined();
  });

  it('GET /api/v1/reader/panel-pacing/profile/:seriesId returns default profile with ETag', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/panel-pacing/profile/jujutsu-kaisen-vol-1',
    });
    expect(res.statusCode).toBe(200);
    const etag = res.headers['etag'];
    expect(etag).toBeDefined();

    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.profile.seriesId).toBe('jujutsu-kaisen-vol-1');
    expect(body.profile.pacingMode).toBe('cinematic_smooth');

    // 304 Not Modified check
    const cachedRes = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/panel-pacing/profile/jujutsu-kaisen-vol-1',
      headers: {
        'if-none-match': etag as string,
      },
    });
    expect(cachedRes.statusCode).toBe(304);
  });

  it('POST /api/v1/reader/panel-pacing/profile updates profile and invalidates cache', async () => {
    const postRes = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/panel-pacing/profile',
      payload: {
        seriesId: 'jujutsu-kaisen-vol-1',
        pacingMode: 'dynamic_action',
        transitionDurationMs: 180,
        zoomOvershootRatio: 1.15,
        edgePaddingPx: 8,
        isMotionReduced: false,
        isEnabled: true,
      },
    });
    expect(postRes.statusCode).toBe(200);
    const postBody = postRes.json();
    expect(postBody.success).toBe(true);
    expect(postBody.profile.pacingMode).toBe('dynamic_action');
    expect(postBody.profile.transitionDurationMs).toBe(180);

    const getRes = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/panel-pacing/profile/jujutsu-kaisen-vol-1',
    });
    expect(getRes.statusCode).toBe(200);
    const getBody = getRes.json();
    expect(getBody.profile.pacingMode).toBe('dynamic_action');
  });

  it('POST /api/v1/reader/panel-pacing/calculate-framing returns valid transform CSS', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/panel-pacing/calculate-framing',
      payload: {
        sourceAabb: { x: 0, y: 0, width: 800, height: 600 },
        targetAabb: { x: 100, y: 200, width: 600, height: 450 },
        viewportWidth: 1280,
        viewportHeight: 720,
        progress: 1.0,
        overshootRatio: 1.05,
        edgePadding: 16,
        isMotionReduced: false,
        durationMs: 280,
        mode: 'cinematic_smooth',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.result.scale).toBeGreaterThan(0);
    expect(body.result.transformCss).toContain('translate3d');
    expect(body.result.transformCss).toContain('scale');
    expect(body.result.transitionCss).toContain('transform 280ms');
  });

  it('computes consistent ETag', () => {
    const etag1 = computePanelPacingEtag('s1', 'cinematic_smooth', 280, 1.05, 16, false, true, 100);
    const etag2 = computePanelPacingEtag('s1', 'cinematic_smooth', 280, 1.05, 16, false, true, 100);
    const etag3 = computePanelPacingEtag('s1', 'dynamic_action', 180, 1.15, 8, false, true, 100);
    expect(etag1).toBe(etag2);
    expect(etag1).not.toBe(etag3);
  });
});
