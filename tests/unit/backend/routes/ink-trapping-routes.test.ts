import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import { inkTrappingRoutes } from '../../../../src/backend/routes/ink-trapping-routes.js';
import { InkTrappingService } from '../../../../src/backend/services/ink-trapping-service.js';

describe('Sprint 131 - Ink Trapping Routes', () => {
  let db: DatabaseInstance;
  let app: FastifyInstance;
  let service: InkTrappingService;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    service = new InkTrappingService(db);
    app = Fastify({ logger: false });
    await app.register(inkTrappingRoutes, {
      db,
      inkTrappingService: service,
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

  it('GET /api/v1/reader/ink-trapping/presets returns all predefined presets', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/ink-trapping/presets',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.presets.vintage_rotary_offset_80s).toBeDefined();
    expect(body.presets.shonen_color_centerfold).toBeDefined();
    expect(body.presets.modern_cmyk_tight).toBeDefined();
    expect(body.presets.misregistered_retro_fringe).toBeDefined();
    expect(body.presets.raw_fixed).toBeDefined();
  });

  it('GET /api/v1/reader/ink-trapping/profile/:seriesId returns default profile and supports 304', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/ink-trapping/profile/series-it-route-1',
    });

    expect(res.statusCode).toBe(200);
    const etag = res.headers.etag;
    expect(etag).toBeDefined();

    const resCached = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/ink-trapping/profile/series-it-route-1',
      headers: {
        'if-none-match': etag,
      },
    });

    expect(resCached.statusCode).toBe(304);
  });

  it('PUT /api/v1/reader/ink-trapping/profile/:seriesId updates profile and validates bounds', async () => {
    const resValid = await app.inject({
      method: 'PUT',
      url: '/api/v1/reader/ink-trapping/profile/series-it-route-2',
      payload: {
        presetName: 'shonen_color_centerfold',
        shiftCx: 0.50,
        trapWidth: 0.40,
        trapMode: 'spread',
      },
    });

    expect(resValid.statusCode).toBe(200);
    const body = JSON.parse(resValid.body);
    expect(body.profile.presetName).toBe('shonen_color_centerfold');
    expect(body.profile.shiftCx).toBe(0.50);
    expect(body.profile.trapMode).toBe('spread');

    // Invalid trapWidth > 2.0
    const resInvalid = await app.inject({
      method: 'PUT',
      url: '/api/v1/reader/ink-trapping/profile/series-it-route-2',
      payload: {
        trapWidth: 5.0,
      },
    });

    expect(resInvalid.statusCode).toBe(400);
  });

  it('POST /api/v1/reader/ink-trapping/simulate executes fast trapping modulation', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/ink-trapping/simulate',
      payload: {
        inR: 210,
        inG: 80,
        inB: 40,
        gradX: 0.6,
        gradY: 0.3,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.result.outR).toBeDefined();
    expect(body.result.latencyUs).toBeDefined();
  });
});
