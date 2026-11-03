import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import { cmykSimulatorRoutes } from '../../../../src/backend/routes/cmyk-simulator-routes.js';
import { CmykSimulatorService } from '../../../../src/backend/services/cmyk-simulator-service.js';

describe('Sprint 128 - CMYK Simulator Routes', () => {
  let db: DatabaseInstance;
  let app: FastifyInstance;
  let service: CmykSimulatorService;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    service = new CmykSimulatorService(db);
    app = Fastify({ logger: false });
    await app.register(cmykSimulatorRoutes, {
      db,
      cmykSimulatorService: service,
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

  it('GET /api/v1/reader/cmyk-simulator/presets returns all predefined presets', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/cmyk-simulator/presets',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.presets.shonen_color_spread).toBeDefined();
    expect(body.presets.tankobon_four_color).toBeDefined();
    expect(body.presets.vintage_faded_pulp).toBeDefined();
    expect(body.presets.cyberpunk_cmyk_boost).toBeDefined();
    expect(body.presets.raw_fixed).toBeDefined();
  });

  it('GET /api/v1/reader/cmyk-simulator/profile/:seriesId returns default profile and supports 304', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/cmyk-simulator/profile/series-cmyk-route-1',
    });

    expect(res.statusCode).toBe(200);
    const etag = res.headers.etag;
    expect(etag).toBeDefined();

    const resCached = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/cmyk-simulator/profile/series-cmyk-route-1',
      headers: {
        'if-none-match': etag as string,
      },
    });

    expect(resCached.statusCode).toBe(304);
  });

  it('PUT /api/v1/reader/cmyk-simulator/profile/:seriesId updates profile safely', async () => {
    const updatePayload = {
      presetName: 'shonen_color_spread',
      tacLimit: 3.10,
      dotGain: 0.15,
      blackAbsorption: 0.12,
      gamutCompression: 0.08,
    };

    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/reader/cmyk-simulator/profile/series-cmyk-route-2',
      payload: updatePayload,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.profile.tacLimit).toBe(3.10);
    expect(body.profile.dotGain).toBe(0.15);
    expect(body.profile.presetName).toBe('shonen_color_spread');
  });

  it('POST /api/v1/reader/cmyk-simulator/evaluate calculates simulated CMYK and reconstructed RGB', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/cmyk-simulator/evaluate',
      payload: {
        r: 180,
        g: 90,
        b: 50,
        tacLimit: 2.80,
        dotGain: 0.10,
        blackAbsorption: 0.10,
        gamutCompression: 0.15,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.result.cyan).toBeDefined();
    expect(body.result.magenta).toBeDefined();
    expect(body.result.yellow).toBeDefined();
    expect(body.result.black).toBeDefined();
    expect(body.result.outR).toBeDefined();
    expect(body.result.totalAreaCoverage).toBeDefined();
  });
});
