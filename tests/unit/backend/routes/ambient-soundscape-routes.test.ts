import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import {
  createDatabase,
  runMigrations,
  DatabaseInstance,
} from '../../../../src/backend/db/database.js';
import { ambientSoundscapeRoutes } from '../../../../src/backend/routes/ambient-soundscape-routes.js';
import { AmbientSoundscapeService } from '../../../../src/backend/services/ambient-soundscape-service.js';

describe('ambientSoundscapeRoutes Fastify Endpoints (Sprint 73)', () => {
  let app: FastifyInstance;
  let db: DatabaseInstance;
  let service: AmbientSoundscapeService;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    runMigrations(db);

    service = new AmbientSoundscapeService(db);

    app = Fastify();
    await app.register(ambientSoundscapeRoutes, { db, soundscapeService: service });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  describe('GET /api/v1/soundscape/presets', () => {
    it('returns all soundscape presets with ETag caching', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/soundscape/presets',
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.count).toBeGreaterThanOrEqual(8);

      const etag = res.headers['etag'];
      expect(etag).toBeDefined();

      const secondRes = await app.inject({
        method: 'GET',
        url: '/api/v1/soundscape/presets',
        headers: {
          'if-none-match': etag as string,
        },
      });
      expect(secondRes.statusCode).toBe(304);
    });

    it('filters presets by query genre', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/soundscape/presets?genre=Seinen',
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.presets.length).toBeGreaterThanOrEqual(1);
      expect(data.presets[0].id).toBe('mist_mystery');
    });
  });

  describe('GET /api/v1/soundscape/preset/:id', () => {
    it('retrieves specific preset by id', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/soundscape/preset/rain_night',
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.preset.id).toBe('rain_night');
      expect(data.preset.title).toBe('Lluvia Nocturna en Ventana');
    });

    it('returns 404 for unknown preset id', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/soundscape/preset/unknown_soundscape_id',
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('GET /api/v1/soundscape/preferences/:userId & PUT', () => {
    it('returns default preferences for user with ETag caching', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/soundscape/preferences/user_snd_1',
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.preferences.userId).toBe('user_snd_1');
      expect(data.preferences.masterVolume).toBe(0.7);

      const etag = res.headers['etag'];
      expect(etag).toBeDefined();

      const secondRes = await app.inject({
        method: 'GET',
        url: '/api/v1/soundscape/preferences/user_snd_1',
        headers: {
          'if-none-match': etag as string,
        },
      });
      expect(secondRes.statusCode).toBe(304);
    });

    it('updates user soundscape preferences via PUT', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/v1/soundscape/preferences',
        payload: {
          userId: 'user_snd_update',
          masterVolume: 0.9,
          isMuted: false,
          autoPlayOnReader: true,
          activePresetId: 'epic_combat',
        },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.preferences.masterVolume).toBe(0.9);
      expect(data.preferences.activePresetId).toBe('epic_combat');
    });

    it('returns 400 for empty userId in GET', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/soundscape/preferences/%20',
      });
      expect(res.statusCode).toBe(400);
    });

    it('returns 400 for invalid PUT body', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/v1/soundscape/preferences',
        payload: {
          userId: 'user_invalid',
          // masterVolume missing
        },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /api/v1/soundscape/calculate-gain', () => {
    it('calculates equal-power cross-fade gain via API', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/soundscape/calculate-gain',
        payload: { t: 0.5 },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.t).toBe(0.5);
      expect(data.gainOut).toBeCloseTo(Math.SQRT1_2, 4);
      expect(data.gainIn).toBeCloseTo(Math.SQRT1_2, 4);
    });

    it('returns 400 when t is not a number', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/soundscape/calculate-gain',
        payload: { t: 'invalid' },
      });
      expect(res.statusCode).toBe(400);
    });
  });
});
