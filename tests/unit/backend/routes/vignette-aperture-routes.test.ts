import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import { vignetteApertureRoutes } from '../../../../src/backend/routes/vignette-aperture-routes.js';
import { VignetteApertureService } from '../../../../src/backend/services/vignette-aperture-service.js';

describe('Sprint 121 - Vignette Aperture Routes', () => {
  let db: DatabaseInstance;
  let app: FastifyInstance;
  let service: VignetteApertureService;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    service = new VignetteApertureService(db);
    app = Fastify({ logger: false });
    await app.register(vignetteApertureRoutes, {
      db,
      vignetteApertureService: service,
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

  it('GET /api/v1/reader/vignette-aperture/presets returns all predefined presets', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/vignette-aperture/presets',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.presets.cinematic_macro).toBeDefined();
    expect(body.presets.action_tunnel).toBeDefined();
    expect(body.presets.subtle_vignette).toBeDefined();
    expect(body.presets.dream_flashback).toBeDefined();
    expect(body.presets.raw_disabled).toBeDefined();
  });

  it('GET /api/v1/reader/vignette-aperture/profile/:seriesId returns default profile and supports 304', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/vignette-aperture/profile/series-vignette-route-1',
    });

    expect(res.statusCode).toBe(200);
    const etag = res.headers.etag;
    expect(etag).toBeDefined();

    const resCached = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/vignette-aperture/profile/series-vignette-route-1',
      headers: {
        'if-none-match': etag as string,
      },
    });
    expect(resCached.statusCode).toBe(304);
  });

  it('POST /api/v1/reader/vignette-aperture/profile updates profile and validates input', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/vignette-aperture/profile',
      payload: {
        seriesId: 'series-vignette-route-1',
        presetName: 'cinematic_macro',
        innerRadius: 0.30,
        outerRadius: 0.90,
        vignetteStrength: 0.60,
        dofBlurFactor: 0.50,
        focusXPct: 40.0,
        focusYPct: 60.0,
        aspectRatio: 1.2,
        isEnabled: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.profile.presetName).toBe('cinematic_macro');
    expect(body.profile.innerRadius).toBe(0.30);
    expect(body.profile.outerRadius).toBe(0.90);
  });

  it('POST /api/v1/reader/vignette-aperture/calculate executes real-time calculation', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/vignette-aperture/calculate',
      payload: {
        pixelX: 700,
        pixelY: 500,
        viewportWidth: 800,
        viewportHeight: 600,
        focusXPct: 50.0,
        focusYPct: 50.0,
        innerRadius: 0.45,
        outerRadius: 1.10,
        vignetteStrength: 0.40,
        dofBlurFactor: 0.35,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.result.normalizedDistance).toBeGreaterThan(0);
    expect(body.result.vignetteAlpha).toBeGreaterThanOrEqual(0);
    expect(body.result.edgeContrast).toBeGreaterThanOrEqual(0.1);
    expect(body.result.cssGradient).toContain('radial-gradient');
  });

  it('POST /api/v1/reader/vignette-aperture/calculate returns 400 when missing parameters', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/vignette-aperture/calculate',
      payload: {
        pixelX: 100,
        // missing pixelY, viewportWidth, viewportHeight
      },
    });

    expect(res.statusCode).toBe(400);
  });
});
