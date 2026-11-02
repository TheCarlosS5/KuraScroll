import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../../src/backend/db/database.js';
import { paperToneRoutes } from '../../../../src/backend/routes/paper-tone-routes.js';
import { PaperToneService } from '../../../../src/backend/services/paper-tone-service.js';

describe('paperToneRoutes Fastify Endpoints (Sprint 64)', () => {
  let app: FastifyInstance;
  let db: DatabaseInstance;
  let service: PaperToneService;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    runMigrations(db);

    service = new PaperToneService(db);

    app = Fastify();
    await app.register(paperToneRoutes, { db, paperToneService: service });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  describe('GET /api/v1/reader/tone/profile', () => {
    it('returns default ORIGINAL profile initially', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/reader/tone/profile',
      });
      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.profile.preset).toBe('ORIGINAL');
      expect(data.profile.svgMatrix).toBeDefined();
    });
  });

  describe('POST /api/v1/reader/tone/profile', () => {
    it('saves paper tone profile and returns updated model with svgMatrix', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/reader/tone/profile',
        payload: {
          userId: 'test_user_route',
          preset: 'PERIODICO_VINTAGE',
          warmth: 0.2,
          contrast: 1.1,
          brightness: 0.95,
        },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.profile.preset).toBe('PERIODICO_VINTAGE');
      expect(data.profile.warmth).toBe(0.2);
      expect(data.profile.contrast).toBe(1.1);
      expect(data.profile.brightness).toBe(0.95);
      expect(data.profile.svgMatrix).toBeDefined();
    });
  });

  describe('DELETE /api/v1/reader/tone/profile', () => {
    it('resets paper tone profile', async () => {
      // First create one
      await app.inject({
        method: 'POST',
        url: '/api/v1/reader/tone/profile',
        payload: {
          userId: 'test_delete_user',
          preset: 'AMBAR_MEDIANOCHE',
        },
      });

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/reader/tone/profile?userId=test_delete_user',
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.reset).toBe(true);
    });
  });

  describe('GET /api/v1/reader/tone/presets', () => {
    it('returns 6 available presets with metadata', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/reader/tone/presets',
      });
      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.count).toBe(6);
      expect(data.presets.length).toBe(6);
    });
  });
});
