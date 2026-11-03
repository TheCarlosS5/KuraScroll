import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import { unsharpMaskRoutes } from '../../../../src/backend/routes/unsharp-mask-routes.js';
import { UnsharpMaskService } from '../../../../src/backend/services/unsharp-mask-service.js';

describe('Sprint 122 - Unsharp Mask Routes', () => {
  let db: DatabaseInstance;
  let app: FastifyInstance;
  let service: UnsharpMaskService;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    service = new UnsharpMaskService(db);
    app = Fastify({ logger: false });
    await app.register(unsharpMaskRoutes, {
      db,
      unsharpMaskService: service,
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

  it('GET /api/v1/reader/unsharp-mask/presets returns all predefined presets', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/unsharp-mask/presets',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.presets.webtoon_ribbon_crisp).toBeDefined();
    expect(body.presets.tankobon_ink_accent).toBeDefined();
    expect(body.presets.vintage_grain_pass).toBeDefined();
    expect(body.presets.furigana_edge_guard).toBeDefined();
    expect(body.presets.raw_neutral).toBeDefined();
  });

  it('GET /api/v1/reader/unsharp-mask/profile/:seriesId returns default profile and supports 304', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/unsharp-mask/profile/series-unsharp-route-1',
    });

    expect(res.statusCode).toBe(200);
    const etag = res.headers.etag;
    expect(etag).toBeDefined();

    const resCached = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/unsharp-mask/profile/series-unsharp-route-1',
      headers: {
        'if-none-match': etag as string,
      },
    });
    expect(resCached.statusCode).toBe(304);
  });

  it('POST /api/v1/reader/unsharp-mask/profile updates profile and validates input', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/unsharp-mask/profile',
      payload: {
        seriesId: 'series-unsharp-route-1',
        presetName: 'furigana_edge_guard',
        sharpness: 1.10,
        edgeThreshold: 10.0,
        haloClamp: 0.03,
        maxWeight: 0.40,
        isEnabled: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.profile.presetName).toBe('furigana_edge_guard');
    expect(body.profile.sharpness).toBe(1.10);
    expect(body.profile.edgeThreshold).toBe(10.0);
  });

  it('POST /api/v1/reader/unsharp-mask/calculate executes real-time calculation', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/unsharp-mask/calculate',
      payload: {
        center: 40,
        north: 180,
        south: 180,
        east: 40,
        west: 40,
        sharpness: 0.85,
        edgeThreshold: 12.0,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.result.outValue).toBeGreaterThanOrEqual(0);
    expect(body.result.outValue).toBeLessThanOrEqual(255);
    expect(body.result.contrast).toBe(140);
  });

  it('POST /api/v1/reader/unsharp-mask/calculate returns 400 when missing stencil inputs', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/unsharp-mask/calculate',
      payload: {
        center: 50,
        // missing north, south, east, west
      },
    });

    expect(res.statusCode).toBe(400);
  });
});
