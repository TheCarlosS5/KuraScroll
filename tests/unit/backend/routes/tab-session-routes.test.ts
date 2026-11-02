import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../../src/backend/db/database.js';
import { tabSessionRoutes } from '../../../../src/backend/routes/tab-session-routes.js';
import { TabSessionService } from '../../../../src/backend/services/tab-session-service.js';

describe('tabSessionRoutes Fastify Endpoints (Sprint 65)', () => {
  let app: FastifyInstance;
  let db: DatabaseInstance;
  let service: TabSessionService;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    runMigrations(db);

    service = new TabSessionService(db);

    app = Fastify();
    await app.register(tabSessionRoutes, { db, tabSessionService: service });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  describe('POST /api/v1/sync/tabs/heartbeat', () => {
    it('returns 400 when tabId is missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/sync/tabs/heartbeat',
        payload: {},
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().message).toContain('tabId');
    });

    it('returns 200 and records tab session heartbeat', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/sync/tabs/heartbeat',
        payload: {
          tabId: 'route_tab_1',
          userId: 'route_user',
          isLeader: true,
          leaderEpoch: 1,
        },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.session.tabId).toBe('route_tab_1');
      expect(data.session.isLeader).toBe(true);
      expect(data.session.leaderEpoch).toBe(1);
    });
  });

  describe('GET /api/v1/sync/tabs/active', () => {
    it('returns 200 with list of active tabs', async () => {
      // Seed a tab
      service.recordHeartbeat({
        tabId: 'tab_active_1',
        userId: 'route_user_2',
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/sync/tabs/active?userId=route_user_2',
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.count).toBe(1);
      expect(data.sessions[0].tabId).toBe('tab_active_1');
    });
  });

  describe('POST /api/v1/sync/tabs/resign', () => {
    it('returns 400 if tabId missing, 200 on valid resign', async () => {
      const errRes = await app.inject({
        method: 'POST',
        url: '/api/v1/sync/tabs/resign',
        payload: {},
      });
      expect(errRes.statusCode).toBe(400);

      service.recordHeartbeat({ tabId: 'tab_to_resign', isLeader: true });

      const okRes = await app.inject({
        method: 'POST',
        url: '/api/v1/sync/tabs/resign',
        payload: { tabId: 'tab_to_resign' },
      });
      expect(okRes.statusCode).toBe(200);
      expect(okRes.json().resigned).toBe(true);
    });
  });

  describe('DELETE /api/v1/sync/tabs/:tabId', () => {
    it('removes tab session on close', async () => {
      service.recordHeartbeat({ tabId: 'tab_to_remove' });

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/sync/tabs/tab_to_remove',
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().removed).toBe(true);
    });
  });
});
