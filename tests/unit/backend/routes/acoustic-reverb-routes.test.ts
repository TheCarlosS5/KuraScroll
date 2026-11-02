import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import { acousticReverbRoutes } from '../../../../src/backend/routes/acoustic-reverb-routes.js';
import { AcousticReverbService } from '../../../../src/backend/services/acoustic-reverb-service.js';

describe('Sprint 108 - Acoustic Reverb Routes', () => {
  let db: DatabaseInstance;
  let app: FastifyInstance;
  let service: AcousticReverbService;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS acoustic_reverb_profiles (
        series_id TEXT PRIMARY KEY,
        scene_environment TEXT NOT NULL DEFAULT 'confined_room' CHECK (scene_environment IN (
            'confined_room',
            'cave_echo',
            'outdoor_open',
            'cathedral_vast',
            'dampened_bedroom',
            'custom'
        )),
        room_size_m3 REAL NOT NULL DEFAULT 85.0 CHECK (room_size_m3 >= 5.0 AND room_size_m3 <= 10000.0),
        absorption_coeff REAL NOT NULL DEFAULT 0.35 CHECK (absorption_coeff >= 0.01 AND absorption_coeff <= 0.99),
        t60_decay_s REAL NOT NULL DEFAULT 1.20 CHECK (t60_decay_s >= 0.10 AND t60_decay_s <= 10.00),
        damping_freq_hz REAL NOT NULL DEFAULT 2800.0 CHECK (damping_freq_hz >= 200.0 AND damping_freq_hz <= 20000.0),
        early_reflections_ms TEXT NOT NULL DEFAULT '[18, 31, 47, 63]',
        wet_dry_mix REAL NOT NULL DEFAULT 0.28 CHECK (wet_dry_mix >= 0.00 AND wet_dry_mix <= 1.00),
        is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_acoustic_reverb_lookup ON acoustic_reverb_profiles(series_id);
    `);

    service = new AcousticReverbService(db);
    app = Fastify({ logger: false });
    await app.register(acousticReverbRoutes, { db, acousticReverbService: service });
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

  it('GET /api/v1/reader/acoustic-reverb/profile/:seriesId returns default profile', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/acoustic-reverb/profile/series-reverb-1',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.profile.seriesId).toBe('series-reverb-1');
    expect(body.profile.sceneEnvironment).toBe('confined_room');
    expect(res.headers.etag).toBeDefined();
  });

  it('GET /api/v1/reader/acoustic-reverb/profile/:seriesId supports ETag 304', async () => {
    const initial = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/acoustic-reverb/profile/series-etag',
    });
    const etag = initial.headers.etag;

    const cached = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/acoustic-reverb/profile/series-etag',
      headers: { 'if-none-match': etag },
    });

    expect(cached.statusCode).toBe(304);
  });

  it('POST /api/v1/reader/acoustic-reverb/profile updates profile', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/acoustic-reverb/profile',
      payload: {
        seriesId: 'series-reverb-update',
        sceneEnvironment: 'cathedral_vast',
        roomSizeM3: 2200.0,
        t60DecayS: 4.0,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.profile.seriesId).toBe('series-reverb-update');
    expect(body.profile.sceneEnvironment).toBe('cathedral_vast');
    expect(body.profile.roomSizeM3).toBe(2200.0);
  });

  it('POST /api/v1/reader/acoustic-reverb/profile returns 400 on empty seriesId', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/acoustic-reverb/profile',
      payload: { seriesId: '' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('POST /api/v1/reader/acoustic-reverb/calculate executes zero-allocation evaluation', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/acoustic-reverb/calculate',
      payload: {
        roomSizeM3: 150.0,
        absorptionCoeff: 0.25,
        t60DecayS: 1.80,
        dampingFreqHz: 2500.0,
        wetDryMix: 0.35,
        sceneEnvironment: 'confined_room',
        isEnabled: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.result.feedbackGain).toBeGreaterThan(0.0);
    expect(body.result.isStable).toBe(true);
    expect(body.result.latencyUs).toBeLessThan(10000);
  });

  it('GET /api/v1/reader/acoustic-reverb/presets returns predefined presets', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/acoustic-reverb/presets',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.presets.cave_echo).toBeDefined();
    expect(body.presets.cathedral_vast).toBeDefined();
  });
});
