import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import { speedLineRoutes } from '../../../../src/backend/routes/speed-line-routes.js';
import { SpeedLineService } from '../../../../src/backend/services/speed-line-service.js';

describe('Sprint 125 - Speed Line Routes', () => {
  let db: DatabaseInstance;
  let app: FastifyInstance;
  let service: SpeedLineService;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    service = new SpeedLineService(db);
    app = Fastify({ logger: false });
    await app.register(speedLineRoutes, {
      db,
      speedLineService: service,
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

  it('GET /api/v1/reader/speed-line/presets returns all predefined presets', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/speed-line/presets',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.presets.shonen_radial_climax).toBeDefined();
    expect(body.presets.dash_horizontal).toBeDefined();
    expect(body.presets.explosion_burst).toBeDefined();
    expect(body.presets.suspense_vortex).toBeDefined();
    expect(body.presets.raw_fixed).toBeDefined();
  });

  it('GET /api/v1/reader/speed-line/profile/:seriesId returns default profile and supports 304', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/speed-line/profile/series-sl-route-1',
    });

    expect(res.statusCode).toBe(200);
    const etag = res.headers.etag;
    expect(etag).toBeDefined();

    const resCached = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/speed-line/profile/series-sl-route-1',
      headers: {
        'if-none-match': etag as string,
      },
    });

    expect(resCached.statusCode).toBe(304);
  });

  it('PUT /api/v1/reader/speed-line/profile/:seriesId updates profile safely', async () => {
    const updatePayload = {
      presetName: 'dash_horizontal',
      mode: 'parallel',
      lineCount: 48,
      focusX: 0.60,
      focusY: 0.40,
      angleJitter: 0.05,
      minLengthRatio: 0.30,
      maxLengthRatio: 0.90,
      minWidthPx: 0.80,
      maxWidthPx: 1.60,
      pulseDurationMs: 200,
    };

    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/reader/speed-line/profile/series-sl-route-2',
      payload: updatePayload,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.profile.lineCount).toBe(48);
    expect(body.profile.mode).toBe('parallel');
    expect(body.profile.presetName).toBe('dash_horizontal');
  });

  it('POST /api/v1/reader/speed-line/evaluate computes line counts and latency', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/speed-line/evaluate',
      payload: {
        mode: 'radial',
        lineCount: 72,
        focusX: 0.50,
        focusY: 0.50,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.count).toBe(72);
    expect(body.latencyUs).toBeDefined();
  });

  it('POST /api/v1/reader/speed-line/pulse evaluates impact kinetics', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/speed-line/pulse',
      payload: {
        elapsedMs: 50,
        pulseDurationMs: 320,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.pulse.isActive).toBe(true);
    expect(body.pulse.pulse).toBeGreaterThan(0.0);
  });
});
