import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import {
  createDatabase,
  runMigrations,
  DatabaseInstance,
} from '../../../../src/backend/db/database.js';
import { kineticParallaxRoutes } from '../../../../src/backend/routes/kinetic-parallax-routes.js';
import { KineticParallaxService } from '../../../../src/backend/services/kinetic-parallax-service.js';

describe('kineticParallaxRoutes Fastify Endpoints (Sprint 70)', () => {
  let app: FastifyInstance;
  let db: DatabaseInstance;
  let service: KineticParallaxService;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    runMigrations(db);

    service = new KineticParallaxService(db);

    app = Fastify();
    await app.register(kineticParallaxRoutes, { db, kineticParallaxService: service });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  describe('GET /api/v1/kinetic/layers/:chapterId/:pageNumber', () => {
    it('returns 400 when pageNumber is invalid', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/kinetic/layers/ch-1/invalid_num',
      });

      expect(res.statusCode).toBe(400);
      const data = res.json();
      expect(data.error).toBe('Bad Request');
    });

    it('returns empty layers array when no layers exist', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/kinetic/layers/ch-1/1',
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.count).toBe(0);
      expect(data.layers).toEqual([]);
    });

    it('supports ETag caching with 304 response', async () => {
      const firstRes = await app.inject({
        method: 'GET',
        url: '/api/v1/kinetic/layers/ch-1/1',
      });

      expect(firstRes.statusCode).toBe(200);
      const etag = firstRes.headers['etag'];
      expect(etag).toBeDefined();

      const secondRes = await app.inject({
        method: 'GET',
        url: '/api/v1/kinetic/layers/ch-1/1',
        headers: {
          'if-none-match': etag as string,
        },
      });

      expect(secondRes.statusCode).toBe(304);
    });
  });

  describe('POST /api/v1/kinetic/layers/register', () => {
    it('returns 400 when required fields are missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/kinetic/layers/register',
        payload: { chapterId: 'ch-1' }, // Missing pageNumber, panelIndex, layers
      });

      expect(res.statusCode).toBe(400);
      const data = res.json();
      expect(data.error).toBe('Bad Request');
    });

    it('successfully registers kinetic layers', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/kinetic/layers/register',
        payload: {
          chapterId: 'ch-climax-70',
          pageNumber: 8,
          panelIndex: 0,
          layers: [
            {
              layerIndex: 0,
              layerRole: 'BACKGROUND',
              normX: 0.0,
              normY: 0.0,
              normW: 1.0,
              normH: 1.0,
              depthFactor: 0.1,
              assetUrl: '/storage/bg.webp',
            },
            {
              layerIndex: 1,
              layerRole: 'FOREGROUND',
              normX: 0.1,
              normY: 0.1,
              normW: 0.8,
              normH: 0.8,
              depthFactor: 1.0,
              assetUrl: '/storage/fg.webp',
            },
          ],
        },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.count).toBe(2);
      expect(data.layers[0].layerRole).toBe('BACKGROUND');
      expect(data.layers[1].depthFactor).toBe(1.0);
    });
  });

  describe('POST /api/v1/kinetic/calculate-drift', () => {
    it('returns 400 when options are missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/kinetic/calculate-drift',
        payload: { layers: [] },
      });

      expect(res.statusCode).toBe(400);
      const data = res.json();
      expect(data.error).toBe('Bad Request');
    });

    it('calculates drifts and CSS transforms accurately', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/kinetic/calculate-drift',
        payload: {
          layers: [
            {
              chapterId: 'ch-1',
              pageNumber: 1,
              panelIndex: 0,
              layerIndex: 0,
              layerRole: 'FOREGROUND',
              normX: 0,
              normY: 0,
              normW: 1,
              normH: 1,
              depthFactor: 1.0,
            },
          ],
          options: {
            inputX: 0.5,
            inputY: -0.5,
            maxOffsetPx: 12.0,
          },
        },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.drifts).toHaveLength(1);
      expect(data.drifts[0].offsetX).toBe(6.0);
      expect(data.drifts[0].offsetY).toBe(-6.0);
      expect(data.drifts[0].cssTransform).toContain('translate3d(6px, -6px, 0)');
    });
  });

  describe('DELETE /api/v1/kinetic/layers/:chapterId/:pageNumber', () => {
    it('deletes kinetic layers successfully', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/kinetic/layers/ch-climax/8',
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain('Kinetic layers deleted');
    });
  });
});
