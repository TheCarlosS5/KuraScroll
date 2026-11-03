import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import { spatialAudioRoutes } from '../../../../src/backend/routes/spatial-audio-routes.js';
import { SpatialAudioService } from '../../../../src/backend/services/spatial-audio-service.js';

describe('Sprint 120 - Spatial Audio Routes', () => {
  let db: DatabaseInstance;
  let app: FastifyInstance;
  let service: SpatialAudioService;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    service = new SpatialAudioService(db);
    app = Fastify({ logger: false });
    await app.register(spatialAudioRoutes, {
      db,
      spatialAudioService: service,
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

  it('GET /api/v1/reader/spatial-audio/presets returns all predefined presets', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/spatial-audio/presets',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.presets.dialogue_near).toBeDefined();
    expect(body.presets.dialogue_occluded).toBeDefined();
    expect(body.presets.indoor_scene).toBeDefined();
    expect(body.presets.action_impact).toBeDefined();
    expect(body.presets.webtoon_vertical_flow).toBeDefined();
  });

  it('GET /api/v1/reader/spatial-audio/profile/:seriesId returns default profile and supports 304', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/spatial-audio/profile/series-spatial-route-1',
    });

    expect(res.statusCode).toBe(200);
    const etag = res.headers.etag;
    expect(etag).toBeDefined();

    const resCached = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/spatial-audio/profile/series-spatial-route-1',
      headers: {
        'if-none-match': etag as string,
      },
    });
    expect(resCached.statusCode).toBe(304);
  });

  it('POST /api/v1/reader/spatial-audio/profile updates profile and validates input', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/spatial-audio/profile',
      payload: {
        seriesId: 'series-spatial-route-1',
        presetName: 'dialogue_occluded',
        referenceDistancePx: 140.0,
        rolloffFactor: 1.2,
        minGain: 0.05,
        maxDistancePx: 1200.0,
        panRadiusPx: 450.0,
        cutoffOpenHz: 16000.0,
        cutoffClosedHz: 1500.0,
        filterQ: 0.8,
        isEnabled: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.profile.presetName).toBe('dialogue_occluded');
    expect(body.profile.referenceDistancePx).toBe(140.0);
    expect(body.profile.cutoffClosedHz).toBe(1500.0);
  });

  it('POST /api/v1/reader/spatial-audio/calculate executes real-time spatial audio calculation', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/spatial-audio/calculate',
      payload: {
        sourceX: 600,
        sourceY: 200,
        listenerX: 200,
        listenerY: 200,
        occlusionFactor: 0.4,
        referenceDistancePx: 120,
        rolloffFactor: 1.0,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.result.distancePx).toBe(400);
    expect(body.result.attenuation).toBeGreaterThan(0);
    expect(body.result.gainLeft).toBeGreaterThanOrEqual(0);
    expect(body.result.gainRight).toBeGreaterThanOrEqual(0);
    expect(body.result.cutoffHz).toBeGreaterThan(2500);
    expect(body.result.cutoffHz).toBeLessThanOrEqual(18000);
  });

  it('POST /api/v1/reader/spatial-audio/calculate returns 400 when missing coordinates', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/spatial-audio/calculate',
      payload: {
        sourceX: 100,
        // missing listenerX, listenerY, sourceY
      },
    });

    expect(res.statusCode).toBe(400);
  });
});
