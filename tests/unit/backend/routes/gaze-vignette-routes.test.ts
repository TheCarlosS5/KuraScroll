import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import { gazeVignetteRoutes } from '../../../../src/backend/routes/gaze-vignette-routes.js';
import { GazeVignetteService } from '../../../../src/backend/services/gaze-vignette-service.js';

describe('Sprint 129 - Gaze Vignette Routes', () => {
  let db: DatabaseInstance;
  let app: FastifyInstance;
  let service: GazeVignetteService;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    service = new GazeVignetteService(db);
    app = Fastify({ logger: false });
    await app.register(gazeVignetteRoutes, {
      db,
      gazeVignetteService: service,
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

  it('GET /api/v1/reader/gaze-vignette/presets returns all predefined presets', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/gaze-vignette/presets',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.presets.deep_focus_tunnel).toBeDefined();
    expect(body.presets.shonen_action_burst).toBeDefined();
    expect(body.presets.relaxed_reading_calm).toBeDefined();
    expect(body.presets.night_monochrome).toBeDefined();
    expect(body.presets.raw_fixed).toBeDefined();
  });

  it('GET /api/v1/reader/gaze-vignette/profile/:seriesId returns default profile and supports 304', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/gaze-vignette/profile/series-gv-route-1',
    });

    expect(res.statusCode).toBe(200);
    const etag = res.headers.etag;
    expect(etag).toBeDefined();

    const resCached = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/gaze-vignette/profile/series-gv-route-1',
      headers: {
        'if-none-match': etag as string,
      },
    });

    expect(resCached.statusCode).toBe(304);
  });

  it('PUT /api/v1/reader/gaze-vignette/profile/:seriesId updates profile safely', async () => {
    const updatePayload = {
      presetName: 'deep_focus_tunnel',
      omega: 18.0,
      vignetteMax: 0.30,
      radiusX: 0.42,
    };

    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/reader/gaze-vignette/profile/series-gv-route-2',
      payload: updatePayload,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.profile.omega).toBe(18.0);
    expect(body.profile.vignetteMax).toBe(0.30);
    expect(body.profile.presetName).toBe('deep_focus_tunnel');
  });

  it('POST /api/v1/reader/gaze-vignette/evaluate calculates stabilized coordinates and vignette opacity', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/gaze-vignette/evaluate',
      payload: {
        currX: 100,
        currY: 100,
        targetX: 130,
        targetY: 120,
        dt: 0.016,
        omega: 8.0,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.result.stabilizedX).toBeDefined();
    expect(body.result.stabilizedY).toBeDefined();
    expect(body.result.vignetteOpacity).toBeDefined();
  });
});
