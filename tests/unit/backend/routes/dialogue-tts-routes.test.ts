import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import {
  createDatabase,
  runMigrations,
  DatabaseInstance,
} from '../../../../src/backend/db/database.js';
import { dialogueTTSRoutes } from '../../../../src/backend/routes/dialogue-tts-routes.js';
import { DialogueTTSService } from '../../../../src/backend/services/dialogue-tts-service.js';

describe('dialogueTTSRoutes Fastify Endpoints (Sprint 75)', () => {
  let app: FastifyInstance;
  let db: DatabaseInstance;
  let service: DialogueTTSService;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    runMigrations(db);

    service = new DialogueTTSService(db);

    app = Fastify();
    await app.register(dialogueTTSRoutes, { db, dialogueTTSService: service });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  describe('GET /api/v1/dialogue-tts/profiles/:seriesId', () => {
    it('returns empty profiles array with valid ETag caching', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/dialogue-tts/profiles/one-piece-route',
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.seriesId).toBe('one-piece-route');
      expect(data.profiles).toEqual([]);

      const etag = res.headers['etag'];
      expect(etag).toBeDefined();

      const secondRes = await app.inject({
        method: 'GET',
        url: '/api/v1/dialogue-tts/profiles/one-piece-route',
        headers: {
          'if-none-match': etag as string,
        },
      });
      expect(secondRes.statusCode).toBe(304);
    });

    it('returns 400 when seriesId is whitespace', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/dialogue-tts/profiles/%20',
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /api/v1/dialogue-tts/profile', () => {
    it('creates or updates a character profile and returns 200', async () => {
      const postRes = await app.inject({
        method: 'POST',
        url: '/api/v1/dialogue-tts/profile',
        payload: {
          seriesId: 'solo-leveling',
          characterName: 'Sung Jin-woo',
          voiceRole: 'male_hero',
          pitchOffset: -0.1,
          rateMultiplier: 1.1,
          preferredVoiceName: 'Korean Male Natural',
        },
      });

      expect(postRes.statusCode).toBe(200);
      const data = postRes.json();
      expect(data.success).toBe(true);
      expect(data.profile.characterName).toBe('Sung Jin-woo');
      expect(data.profile.voiceRole).toBe('male_hero');
      expect(data.profile.pitchOffset).toBe(-0.1);

      // Verify retrieval
      const getRes = await app.inject({
        method: 'GET',
        url: '/api/v1/dialogue-tts/profiles/solo-leveling',
      });
      expect(getRes.statusCode).toBe(200);
      expect(getRes.json().profiles).toHaveLength(1);
    });

    it('returns 400 on missing required fields', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/dialogue-tts/profile',
        payload: {
          characterName: 'Incomplete',
        },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET & PUT /api/v1/dialogue-tts/preferences/:userId', () => {
    it('returns defaults and handles updates with ETag support', async () => {
      const getRes = await app.inject({
        method: 'GET',
        url: '/api/v1/dialogue-tts/preferences/user_test_tts',
      });

      expect(getRes.statusCode).toBe(200);
      const data = getRes.json();
      expect(data.preferences.masterRate).toBe(1.0);
      expect(data.preferences.masterVolume).toBe(1.0);

      const etag = getRes.headers['etag'];
      const cachedRes = await app.inject({
        method: 'GET',
        url: '/api/v1/dialogue-tts/preferences/user_test_tts',
        headers: {
          'if-none-match': etag as string,
        },
      });
      expect(cachedRes.statusCode).toBe(304);

      // Update preferences
      const putRes = await app.inject({
        method: 'PUT',
        url: '/api/v1/dialogue-tts/preferences',
        payload: {
          userId: 'user_test_tts',
          masterRate: 1.4,
          masterVolume: 0.8,
          autoAdvance: false,
        },
      });

      expect(putRes.statusCode).toBe(200);
      const putData = putRes.json();
      expect(putData.preferences.masterRate).toBe(1.4);
      expect(putData.preferences.autoAdvance).toBe(false);
    });

    it('returns 400 when userId is missing on PUT', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/v1/dialogue-tts/preferences',
        payload: {
          masterRate: 1.2,
        },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /api/v1/dialogue-tts/resolve-queue', () => {
    it('resolves dialogue queue with roles and duration estimate', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/dialogue-tts/resolve-queue',
        payload: {
          bubbles: [
            { id: 'b1', pageIndex: 0, characterName: 'Narrador', text: 'El viaje comienza.' },
            { id: 'b2', pageIndex: 0, characterName: 'Anya', text: '¡Waku waku!' },
          ],
          profiles: [
            { seriesId: 'sfx', characterName: 'Anya', voiceRole: 'child_creature', pitchOffset: 0.2, rateMultiplier: 1.1 },
          ],
          userPrefs: {
            masterRate: 1.0,
            masterVolume: 0.9,
          },
        },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.queue.totalBubbles).toBe(2);
      expect(data.queue.items[1].role).toBe('child_creature');
      expect(data.queue.items[1].pitch).toBeGreaterThan(1.4);
    });

    it('returns 400 when bubbles parameter is not an array', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/dialogue-tts/resolve-queue',
        payload: {
          bubbles: 'invalid',
        },
      });
      expect(res.statusCode).toBe(400);
    });
  });
});
