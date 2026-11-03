import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import { celluloseReliefRoutes } from '../../../../src/backend/routes/cellulose-relief-routes.js';
import { CelluloseReliefService } from '../../../../src/backend/services/cellulose-relief-service.js';

describe('Sprint 133 - Cellulose Relief Routes', () => {
  let db: DatabaseInstance;
  let app: FastifyInstance;
  let service: CelluloseReliefService;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    service = new CelluloseReliefService(db);
    app = Fastify({ logger: false });
    await app.register(celluloseReliefRoutes, {
      db,
      celluloseReliefService: service,
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

  it('GET /api/v1/reader/cellulose-relief/presets returns all canonical presets', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/cellulose-relief/presets',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.presets.tankobon_woodfree_matte).toBeDefined();
    expect(body.presets.shonen_pulp_unbleached).toBeDefined();
    expect(body.presets.kanzenban_cotton_satin).toBeDefined();
    expect(body.presets.vintage_aged_newsprint).toBeDefined();
    expect(body.presets.raw_fixed).toBeDefined();
  });

  it('GET /api/v1/reader/cellulose-relief/profile/:seriesId returns profile and supports 304 ETag', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/cellulose-relief/profile/series-cr-1',
    });

    expect(res.statusCode).toBe(200);
    const etag = res.headers.etag;
    expect(etag).toBeDefined();

    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.profile.presetName).toBe('tankobon_woodfree_matte');

    const resCached = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/cellulose-relief/profile/series-cr-1',
      headers: {
        'if-none-match': etag as string,
      },
    });

    expect(resCached.statusCode).toBe(304);
  });

  it('PUT /api/v1/reader/cellulose-relief/profile/:seriesId updates profile and validates boundaries', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/reader/cellulose-relief/profile/series-cr-update',
      payload: {
        presetName: 'shonen_pulp_unbleached',
        grainScale: 1.5,
        reliefDepth: 0.4,
        fiberDensity: 0.7,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.profile.presetName).toBe('shonen_pulp_unbleached');
    expect(body.profile.grainScale).toBe(1.5);
    expect(body.profile.reliefDepth).toBe(0.4);
    expect(body.profile.fiberDensity).toBe(0.7);

    // Validation rejection on out-of-bounds grainScale
    const resInvalid = await app.inject({
      method: 'PUT',
      url: '/api/v1/reader/cellulose-relief/profile/series-cr-update',
      payload: {
        grainScale: 99.0,
      },
    });

    expect(resInvalid.statusCode).toBe(400);
  });

  it('POST /api/v1/reader/cellulose-relief/preset/:seriesId applies preset', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/cellulose-relief/preset/series-cr-preset',
      payload: {
        presetName: 'kanzenban_cotton_satin',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.profile.presetName).toBe('kanzenban_cotton_satin');
    expect(body.profile.reliefDepth).toBe(0.08);
  });

  it('POST /api/v1/reader/cellulose-relief/evaluate returns high-speed evaluation', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/cellulose-relief/evaluate',
      payload: {
        x: 100,
        y: 200,
        kDensity: 0.1,
        profile: {
          grainScale: 1.0,
          reliefDepth: 0.3,
          fiberDensity: 0.5,
          lightAngle: 0.785398,
          isEnabled: true,
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.result.effectiveRelief).toBeGreaterThan(0.0);
    expect(body.result.diffuseLight).toBeGreaterThan(0.0);
  });

  it('DELETE /api/v1/reader/cellulose-relief/profile/:seriesId deletes saved profile', async () => {
    await app.inject({
      method: 'PUT',
      url: '/api/v1/reader/cellulose-relief/profile/series-cr-del',
      payload: { presetName: 'vintage_aged_newsprint' },
    });

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/v1/reader/cellulose-relief/profile/series-cr-del',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.deleted).toBe(true);
  });
});
