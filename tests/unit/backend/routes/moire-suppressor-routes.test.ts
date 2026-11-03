import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import { moireSuppressorRoutes } from '../../../../src/backend/routes/moire-suppressor-routes.js';
import { MoireSuppressorService } from '../../../../src/backend/services/moire-suppressor-service.js';

describe('Sprint 127 - Moire Suppressor Routes', () => {
  let db: DatabaseInstance;
  let app: FastifyInstance;
  let service: MoireSuppressorService;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    service = new MoireSuppressorService(db);
    app = Fastify({ logger: false });
    await app.register(moireSuppressorRoutes, {
      db,
      moireSuppressorService: service,
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

  it('GET /api/v1/reader/moire-suppressor/presets returns all predefined presets', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/moire-suppressor/presets',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.presets.manga_screentone_soften).toBeDefined();
    expect(body.presets.newsprint_despeckle).toBeDefined();
    expect(body.presets.dense_crosshatch_calm).toBeDefined();
    expect(body.presets.vintage_magazine_smooth).toBeDefined();
    expect(body.presets.raw_fixed).toBeDefined();
  });

  it('GET /api/v1/reader/moire-suppressor/profile/:seriesId returns default profile and supports 304', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/moire-suppressor/profile/series-ms-route-1',
    });

    expect(res.statusCode).toBe(200);
    const etag = res.headers.etag;
    expect(etag).toBeDefined();

    const resCached = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/moire-suppressor/profile/series-ms-route-1',
      headers: {
        'if-none-match': etag as string,
      },
    });

    expect(resCached.statusCode).toBe(304);
  });

  it('PUT /api/v1/reader/moire-suppressor/profile/:seriesId updates profile safely', async () => {
    const updatePayload = {
      presetName: 'dense_crosshatch_calm',
      suppressionStrength: 0.25,
      deltaClamp: 10.0,
      edgeThreshold: 38.0,
      filterRadius: 2,
    };

    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/reader/moire-suppressor/profile/series-ms-route-2',
      payload: updatePayload,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.profile.suppressionStrength).toBe(0.25);
    expect(body.profile.deltaClamp).toBe(10.0);
    expect(body.profile.edgeThreshold).toBe(38.0);
    expect(body.profile.presetName).toBe('dense_crosshatch_calm');
  });

  it('POST /api/v1/reader/moire-suppressor/evaluate calculates suppressed luminance and edge protection', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/moire-suppressor/evaluate',
      payload: {
        centerLum: 120,
        localAvgLum: 150,
        dLdx: 5,
        dLdy: 10,
        autocorrPeak: 0.7,
        suppressionStrength: 0.45,
        deltaClamp: 16.0,
        edgeThreshold: 32.0,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.result.filteredLuminance).toBeGreaterThan(120);
    expect(body.result.isEdgeProtected).toBe(false);
    expect(body.result.latencyUs).toBeDefined();
  });
});
