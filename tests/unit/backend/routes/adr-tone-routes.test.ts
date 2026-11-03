import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import { adrToneRoutes } from '../../../../src/backend/routes/adr-tone-routes.js';
import { ADRToneService } from '../../../../src/backend/services/adr-tone-service.js';

describe('Sprint 123 - ADR Tone Routes', () => {
  let db: DatabaseInstance;
  let app: FastifyInstance;
  let service: ADRToneService;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    service = new ADRToneService(db);
    app = Fastify({ logger: false });
    await app.register(adrToneRoutes, {
      db,
      adrToneService: service,
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

  it('GET /api/v1/reader/adr-tone/presets returns all predefined presets', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/adr-tone/presets',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.presets.berserk_night_recovery).toBeDefined();
    expect(body.presets.shonen_deep_black).toBeDefined();
    expect(body.presets.vintage_newsprint_gamma).toBeDefined();
    expect(body.presets.webtoon_vibrant_range).toBeDefined();
    expect(body.presets.raw_linear).toBeDefined();
  });

  it('GET /api/v1/reader/adr-tone/profile/:seriesId returns default profile and supports 304', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/adr-tone/profile/series-adr-route-1',
    });

    expect(res.statusCode).toBe(200);
    const etag = res.headers.etag;
    expect(etag).toBeDefined();

    const resCached = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/adr-tone/profile/series-adr-route-1',
      headers: {
        'if-none-match': etag as string,
      },
    });
    expect(resCached.statusCode).toBe(304);
  });

  it('POST /api/v1/reader/adr-tone/profile updates profile and validates input', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/adr-tone/profile',
      payload: {
        seriesId: 'series-adr-route-1',
        presetName: 'shonen_deep_black',
        shadowLift: 0.25,
        gamma: 1.10,
        shoulderClamp: 0.98,
        whitePoint: 1.00,
        isEnabled: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.profile.presetName).toBe('shonen_deep_black');
    expect(body.profile.shadowLift).toBe(0.25);
    expect(body.profile.gamma).toBe(1.10);
  });

  it('POST /api/v1/reader/adr-tone/calculate executes real-time calculation', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/adr-tone/calculate',
      payload: {
        luminance: 30,
        shadowLift: 0.55,
        gamma: 1.25,
        shoulderClamp: 0.95,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.result.outLuminance).toBeGreaterThan(0);
    expect(body.result.outLuminance).toBeLessThanOrEqual(255);
    expect(body.result.normalizedIn).toBeCloseTo(30 / 255.0, 2);
  });

  it('POST /api/v1/reader/adr-tone/calculate returns 400 when missing luminance', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/adr-tone/calculate',
      payload: {
        // missing luminance
      },
    });

    expect(res.statusCode).toBe(400);
  });
});
