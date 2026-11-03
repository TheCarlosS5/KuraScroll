import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import { lensDistortionRoutes } from '../../../../src/backend/routes/lens-distortion-routes.js';
import { LensDistortionService } from '../../../../src/backend/services/lens-distortion-service.js';

describe('Sprint 126 - Lens Distortion Routes', () => {
  let db: DatabaseInstance;
  let app: FastifyInstance;
  let service: LensDistortionService;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    service = new LensDistortionService(db);
    app = Fastify({ logger: false });
    await app.register(lensDistortionRoutes, {
      db,
      lensDistortionService: service,
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

  it('GET /api/v1/reader/lens-distortion/presets returns all predefined presets', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/lens-distortion/presets',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.presets.tankobon_flatbed_scanner).toBeDefined();
    expect(body.presets.aged_lens_barrel).toBeDefined();
    expect(body.presets.pincushion_edge_fix).toBeDefined();
    expect(body.presets.subtle_neutralizer).toBeDefined();
    expect(body.presets.raw_fixed).toBeDefined();
  });

  it('GET /api/v1/reader/lens-distortion/profile/:seriesId returns default profile and supports 304', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/lens-distortion/profile/series-ld-route-1',
    });

    expect(res.statusCode).toBe(200);
    const etag = res.headers.etag;
    expect(etag).toBeDefined();

    const resCached = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/lens-distortion/profile/series-ld-route-1',
      headers: {
        'if-none-match': etag as string,
      },
    });

    expect(resCached.statusCode).toBe(304);
  });

  it('PUT /api/v1/reader/lens-distortion/profile/:seriesId updates profile safely', async () => {
    const updatePayload = {
      presetName: 'aged_lens_barrel',
      k1: -0.030,
      k2: 0.004,
      redShift: 0.006,
      blueShift: -0.006,
      scale: 1.01,
    };

    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/reader/lens-distortion/profile/series-ld-route-2',
      payload: updatePayload,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.profile.k1).toBe(-0.030);
    expect(body.profile.presetName).toBe('aged_lens_barrel');
  });

  it('POST /api/v1/reader/lens-distortion/evaluate calculates compensated coordinates and chromatic offsets', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/lens-distortion/evaluate',
      payload: {
        normX: 0.90,
        normY: 0.90,
        k1: -0.015,
        k2: 0.002,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.result.correctedX).toBeDefined();
    expect(body.result.redOffsetX).toBeDefined();
    expect(body.result.blueOffsetX).toBeDefined();
  });
});
