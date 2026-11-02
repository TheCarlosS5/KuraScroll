import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { prefetchRoutes } from '../../../../src/backend/routes/prefetch-routes.js';
import { PredictivePrefetchDaemon } from '../../../../src/backend/services/predictive-prefetch-daemon.js';

describe('prefetchRoutes Fastify Endpoints (Sprint 59)', () => {
  let app: FastifyInstance;
  let daemon: PredictivePrefetchDaemon;

  beforeEach(async () => {
    daemon = new PredictivePrefetchDaemon();
    app = Fastify();
    await app.register(prefetchRoutes, { prefetchDaemon: daemon });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /api/v1/prefetch/navigate', () => {
    it('returns 400 when chapterId or pageNumber is missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/prefetch/navigate',
        payload: {
          chapterId: 'chap-1',
          // missing pageNumber
        },
      });

      expect(res.statusCode).toBe(400);
      const json = res.json();
      expect(json.message).toContain('required');
    });

    it('returns 200 with candidates and transition probabilities for valid navigation', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/prefetch/navigate',
        payload: {
          chapterId: 'chap-1',
          pageNumber: 3,
          previousPage: 2,
          dwellSeconds: 15.0,
          totalPages: 20,
          targetWidth: 1200,
        },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.candidates).toBeDefined();
      expect(json.candidates.length).toBeGreaterThan(0);
      expect(json.probabilities).toBeDefined();
      expect(json.probabilities.advance).toBeGreaterThan(0.7);
    });
  });

  describe('GET /api/v1/prefetch/warmth', () => {
    it('returns 400 when missing parameters', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/prefetch/warmth',
      });
      expect(res.statusCode).toBe(400);
    });

    it('returns 200 with warmth status', async () => {
      // Pre-warm a page
      daemon.setWarmth('chap-1', 5, 1200, 'hot');

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/prefetch/warmth?chapterId=chap-1&pageNumber=5&width=1200',
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.chapterId).toBe('chap-1');
      expect(json.pageNumber).toBe(5);
      expect(json.warmth).toBe('hot');

      // Check an unwarmed page returns cold
      const resCold = await app.inject({
        method: 'GET',
        url: '/api/v1/prefetch/warmth?chapterId=chap-1&pageNumber=99&width=1200',
      });
      expect(resCold.json().warmth).toBe('cold');
    });
  });

  describe('POST /api/v1/prefetch/mark-hot', () => {
    it('returns 400 on invalid input', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/prefetch/mark-hot',
        payload: {},
      });
      expect(res.statusCode).toBe(400);
    });

    it('marks page as hot and confirms state update', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/prefetch/mark-hot',
        payload: {
          chapterId: 'chap-test',
          pageNumber: 12,
          width: 800,
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
      expect(res.json().warmth).toBe('hot');

      expect(daemon.getWarmth('chap-test', 12, 800)).toBe('hot');
    });
  });

  describe('GET /api/v1/prefetch/stats', () => {
    it('returns prefetch telemetry statistics', async () => {
      daemon.setWarmth('chap-1', 1, 1200, 'hot');
      daemon.setWarmth('chap-1', 2, 1200, 'hot');

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/prefetch/stats',
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.stats.warmedCount).toBe(2);
      expect(json.stats.priors.advance).toBeGreaterThan(0.7);
    });
  });
});
