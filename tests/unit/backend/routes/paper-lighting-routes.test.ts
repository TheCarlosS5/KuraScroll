import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import { paperLightingRoutes } from '../../../../src/backend/routes/paper-lighting-routes.js';
import { PaperLightingService } from '../../../../src/backend/services/paper-lighting-service.js';

describe('Sprint 130 - Paper Lighting Routes', () => {
  let db: DatabaseInstance;
  let app: FastifyInstance;
  let service: PaperLightingService;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    service = new PaperLightingService(db);
    app = Fastify({ logger: false });
    await app.register(paperLightingRoutes, {
      db,
      paperLightingService: service,
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

  it('GET /api/v1/reader/paper-lighting/presets returns all predefined presets', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/paper-lighting/presets',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.presets.tankobon_deluxe_matte).toBeDefined();
    expect(body.presets.shonen_pulp_newsprint).toBeDefined();
    expect(body.presets.doujinshi_satin).toBeDefined();
    expect(body.presets.vintage_aged_pulp).toBeDefined();
    expect(body.presets.raw_fixed).toBeDefined();
  });

  it('GET /api/v1/reader/paper-lighting/profile/:seriesId returns default profile and supports 304', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/paper-lighting/profile/series-pl-route-1',
    });

    expect(res.statusCode).toBe(200);
    const etag = res.headers.etag;
    expect(etag).toBeDefined();

    const resCached = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/paper-lighting/profile/series-pl-route-1',
      headers: {
        'if-none-match': etag,
      },
    });

    expect(resCached.statusCode).toBe(304);
  });

  it('PUT /api/v1/reader/paper-lighting/profile/:seriesId updates profile and validates bounds', async () => {
    const resValid = await app.inject({
      method: 'PUT',
      url: '/api/v1/reader/paper-lighting/profile/series-pl-route-2',
      payload: {
        presetName: 'doujinshi_satin',
        specularKs: 0.35,
        roughness: 0.20,
      },
    });

    expect(resValid.statusCode).toBe(200);
    const body = JSON.parse(resValid.body);
    expect(body.profile.presetName).toBe('doujinshi_satin');
    expect(body.profile.specularKs).toBe(0.35);

    // Invalid specularKs > 1.0
    const resInvalid = await app.inject({
      method: 'PUT',
      url: '/api/v1/reader/paper-lighting/profile/series-pl-route-2',
      payload: {
        specularKs: 2.5,
      },
    });

    expect(resInvalid.statusCode).toBe(400);
  });

  it('POST /api/v1/reader/paper-lighting/simulate executes fast lighting modulation', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/paper-lighting/simulate',
      payload: {
        pixelXNorm: 0.50,
        pixelYNorm: 0.30,
        inR: 240,
        inG: 240,
        inB: 240,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.result.outR).toBeGreaterThan(0);
    expect(body.result.diffuseIntensity).toBeGreaterThan(0);
    expect(body.result.latencyUs).toBeDefined();
  });
});
