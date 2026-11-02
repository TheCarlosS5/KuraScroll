import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import {
  createDatabase,
  runMigrations,
  DatabaseInstance,
} from '../../../../src/backend/db/database.js';
import { chapterTransitionRoutes } from '../../../../src/backend/routes/chapter-transition-routes.js';
import { ChapterTransitionService } from '../../../../src/backend/services/chapter-transition-service.js';

describe('chapterTransitionRoutes Fastify Endpoints (Sprint 79)', () => {
  let app: FastifyInstance;
  let db: DatabaseInstance;
  let service: ChapterTransitionService;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    runMigrations(db);

    service = new ChapterTransitionService(db);

    app = Fastify();
    await app.register(chapterTransitionRoutes, { db, chapterTransitionService: service });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  describe('GET /api/v1/transition/profile/:seriesId', () => {
    it('returns default profile with valid ETag caching (HTTP 304)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/transition/profile/series_transition_route',
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.profile.seriesId).toBe('series_transition_route');
      expect(data.profile.transitionStyle).toBe('curtain');
      expect(data.profile.prebakeTriggerPageOffset).toBe(3);

      const etag = res.headers['etag'];
      expect(etag).toBeDefined();

      const secondRes = await app.inject({
        method: 'GET',
        url: '/api/v1/transition/profile/series_transition_route',
        headers: {
          'if-none-match': etag as string,
        },
      });
      expect(secondRes.statusCode).toBe(304);
    });

    it('returns 400 when seriesId is whitespace', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/transition/profile/%20',
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /api/v1/transition/profile', () => {
    it('creates or updates a transition profile and returns 200', async () => {
      const postRes = await app.inject({
        method: 'POST',
        url: '/api/v1/transition/profile',
        payload: {
          seriesId: 'series_transition_route',
          fromChapterId: 'chap-10',
          toChapterId: 'chap-11',
          transitionStyle: 'infinite_scroll',
          prebakeTriggerPageOffset: 4,
          autoAdvanceDelayMs: 0,
          showReadingSummary: false,
          isEnabled: true,
        },
      });

      expect(postRes.statusCode).toBe(200);
      const postData = postRes.json();
      expect(postData.success).toBe(true);
      expect(postData.profile.transitionStyle).toBe('infinite_scroll');
      expect(postData.profile.prebakeTriggerPageOffset).toBe(4);

      // Verify retrieval with fromChapterId
      const getRes = await app.inject({
        method: 'GET',
        url: '/api/v1/transition/profile/series_transition_route?fromChapterId=chap-10',
      });
      expect(getRes.statusCode).toBe(200);
      const getData = getRes.json();
      expect(getData.profile.transitionStyle).toBe('infinite_scroll');
      expect(getData.profile.toChapterId).toBe('chap-11');
    });

    it('returns 400 when seriesId is missing', async () => {
      const postRes = await app.inject({
        method: 'POST',
        url: '/api/v1/transition/profile',
        payload: {
          transitionStyle: 'curtain',
        },
      });

      expect(postRes.statusCode).toBe(400);
    });
  });

  describe('POST /api/v1/transition/resolve-state', () => {
    it('calculates transition state directly from payload', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/transition/resolve-state',
        payload: {
          currentPage: 25,
          totalPages: 25,
          nextChapterId: 'chap-26',
          nextChapterTitle: 'El Despertar',
          nextChapterNumber: 26,
        },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.result.shouldPrebake).toBe(true);
      expect(data.result.showCurtain).toBe(true);
      expect(data.result.nextChapterTitle).toBe('El Despertar');
    });

    it('returns 400 when currentPage or totalPages is missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/transition/resolve-state',
        payload: {
          nextChapterId: 'chap-2',
        },
      });

      expect(res.statusCode).toBe(400);
    });
  });
});
