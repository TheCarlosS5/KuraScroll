import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import { inkSplatterRoutes } from '../../../../src/backend/routes/ink-splatter-routes.js';
import { InkSplatterService } from '../../../../src/backend/services/ink-splatter-service.js';

describe('Sprint 134 - Ink Splatter Routes', () => {
  let db: DatabaseInstance;
  let app: FastifyInstance;
  let service: InkSplatterService;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    service = new InkSplatterService(db);
    app = Fastify({ logger: false });
    await app.register(inkSplatterRoutes, {
      db,
      inkSplatterService: service,
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

  it('GET /api/v1/reader/ink-splatter/presets returns all canonical presets', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/ink-splatter/presets',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.presets.shonen_impact_burst).toBeDefined();
    expect(body.presets.vintage_gpen_newsprint).toBeDefined();
    expect(body.presets.deluxe_bristol_clean).toBeDefined();
    expect(body.presets.dramatic_blood_splatter).toBeDefined();
    expect(body.presets.raw_fixed).toBeDefined();
  });

  it('GET /api/v1/reader/ink-splatter/profile/:seriesId returns profile and supports 304 ETag', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/ink-splatter/profile/series-is-1',
    });

    expect(res.statusCode).toBe(200);
    const etag = res.headers.etag;
    expect(etag).toBeDefined();

    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.profile.presetName).toBe('shonen_impact_burst');

    const resCached = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/ink-splatter/profile/series-is-1',
      headers: {
        'if-none-match': etag as string,
      },
    });

    expect(resCached.statusCode).toBe(304);
  });

  it('PUT /api/v1/reader/ink-splatter/profile/:seriesId updates profile and validates boundaries', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/reader/ink-splatter/profile/series-is-update',
      payload: {
        presetName: 'vintage_gpen_newsprint',
        strokeVelocity: 350.0,
        bleedRadiusPx: 2.0,
        splatterDensity: 0.5,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.profile.presetName).toBe('vintage_gpen_newsprint');
    expect(body.profile.strokeVelocity).toBe(350.0);
    expect(body.profile.bleedRadiusPx).toBe(2.0);
    expect(body.profile.splatterDensity).toBe(0.5);

    // Validation rejection on out-of-bounds strokeVelocity
    const resInvalid = await app.inject({
      method: 'PUT',
      url: '/api/v1/reader/ink-splatter/profile/series-is-update',
      payload: {
        strokeVelocity: 9999.0,
      },
    });

    expect(resInvalid.statusCode).toBe(400);
  });

  it('POST /api/v1/reader/ink-splatter/preset/:seriesId applies preset', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/ink-splatter/preset/series-is-preset',
      payload: {
        presetName: 'dramatic_blood_splatter',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.profile.presetName).toBe('dramatic_blood_splatter');
    expect(body.profile.strokeVelocity).toBe(950.0);
  });

  it('POST /api/v1/reader/ink-splatter/evaluate returns high-speed evaluation', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/ink-splatter/evaluate',
      payload: {
        originX: 100,
        originY: 150,
        angleRad: 0.785,
        strokeVelocity: 500.0,
        profile: {
          bleedRadiusPx: 1.5,
          splatterDensity: 0.6,
          wickingRate: 0.5,
          isEnabled: true,
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.result.dropletCount).toBeGreaterThan(0);
    expect(body.result.effectiveBleed).toBeGreaterThan(0);
  });

  it('DELETE /api/v1/reader/ink-splatter/profile/:seriesId deletes saved profile', async () => {
    await app.inject({
      method: 'PUT',
      url: '/api/v1/reader/ink-splatter/profile/series-is-del',
      payload: { presetName: 'vintage_gpen_newsprint' },
    });

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/v1/reader/ink-splatter/profile/series-is-del',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.deleted).toBe(true);
  });
});
