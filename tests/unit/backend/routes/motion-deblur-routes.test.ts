import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import { motionDeblurRoutes } from '../../../../src/backend/routes/motion-deblur-routes.js';
import { MotionDeblurService } from '../../../../src/backend/services/motion-deblur-service.js';

describe('Sprint 132 - Motion Deblur Routes', () => {
  let db: DatabaseInstance;
  let app: FastifyInstance;
  let service: MotionDeblurService;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    service = new MotionDeblurService(db);
    app = Fastify({ logger: false });
    await app.register(motionDeblurRoutes, {
      db,
      motionDeblurService: service,
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

  it('GET /api/v1/reader/motion-deblur/presets returns all predefined presets', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/motion-deblur/presets',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.presets.tn_slow_panel_compensation).toBeDefined();
    expect(body.presets.webtoon_high_speed_flick).toBeDefined();
    expect(body.presets.subtle_lcd_response_boost).toBeDefined();
    expect(body.presets.extreme_ghosting_killer).toBeDefined();
    expect(body.presets.raw_fixed).toBeDefined();
  });

  it('GET /api/v1/reader/motion-deblur/profile/:seriesId returns default profile and supports 304', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/motion-deblur/profile/series-md-route-1',
    });

    expect(res.statusCode).toBe(200);
    const etag = res.headers.etag;
    expect(etag).toBeDefined();

    const resCached = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/motion-deblur/profile/series-md-route-1',
      headers: {
        'if-none-match': etag,
      },
    });

    expect(resCached.statusCode).toBe(304);
  });

  it('PUT /api/v1/reader/motion-deblur/profile/:seriesId updates profile and validates bounds', async () => {
    const resValid = await app.inject({
      method: 'PUT',
      url: '/api/v1/reader/motion-deblur/profile/series-md-route-2',
      payload: {
        presetName: 'webtoon_high_speed_flick',
        kod: 2.2,
        vHalf: 450.0,
      },
    });

    expect(resValid.statusCode).toBe(200);
    const body = JSON.parse(resValid.body);
    expect(body.profile.presetName).toBe('webtoon_high_speed_flick');
    expect(body.profile.kod).toBe(2.2);

    // Invalid kod > 3.0
    const resInvalid = await app.inject({
      method: 'PUT',
      url: '/api/v1/reader/motion-deblur/profile/series-md-route-2',
      payload: {
        kod: 5.5,
      },
    });

    expect(resInvalid.statusCode).toBe(400);
  });

  it('POST /api/v1/reader/motion-deblur/simulate executes fast overdrive simulation', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/motion-deblur/simulate',
      payload: {
        inL: 220,
        prevL: 140,
        velocityPxS: 1100.0,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.result.outL).toBeGreaterThan(0);
    expect(body.result.boost).toBeGreaterThan(0);
    expect(body.result.latencyUs).toBeDefined();
  });
});
