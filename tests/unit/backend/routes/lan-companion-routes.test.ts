import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import {
  createDatabase,
  runMigrations,
  DatabaseInstance,
} from '../../../../src/backend/db/database.js';
import { lanCompanionRoutes } from '../../../../src/backend/routes/lan-companion-routes.js';
import { LanCompanionService } from '../../../../src/backend/services/lan-companion-service.js';

describe('lanCompanionRoutes Fastify Endpoints (Sprint 69)', () => {
  let app: FastifyInstance;
  let db: DatabaseInstance;
  let service: LanCompanionService;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    runMigrations(db);

    service = new LanCompanionService(db);

    app = Fastify();
    await app.register(lanCompanionRoutes, { db, lanCompanionService: service, port: 4000 });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  describe('GET /api/v1/network/lan-info', () => {
    it('returns 200 with local host networking details', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/network/lan-info',
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.lanIp).toBeDefined();
      expect(data.port).toBe(4000);
      expect(typeof data.pairedDevicesCount).toBe('number');
    });
  });

  describe('POST /api/v1/network/qr-pair/create', () => {
    it('creates an ephemeral QR pairing session returning 201', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/network/qr-pair/create',
      });

      expect(res.statusCode).toBe(201);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.pairingId).toBeDefined();
      expect(data.rawToken).toBeDefined();
      expect(data.qrSvg).toContain('<svg');
      expect(data.pairingUrl).toContain('/companion/#pairingId=');
    });
  });

  describe('POST /api/v1/network/qr-pair/handshake', () => {
    it('returns 400 when missing pairingId or rawToken', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/network/qr-pair/handshake',
        payload: {},
      });

      expect(res.statusCode).toBe(400);
    });

    it('returns 200 and sessionToken on successful mobile phone pairing', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/network/qr-pair/create',
      });
      const created = createRes.json();

      const handshakeRes = await app.inject({
        method: 'POST',
        url: '/api/v1/network/qr-pair/handshake',
        payload: {
          pairingId: created.pairingId,
          rawToken: created.rawToken,
          deviceName: 'iPhone 15 Pro',
          deviceType: 'mobile',
        },
      });

      expect(handshakeRes.statusCode).toBe(200);
      const data = handshakeRes.json();
      expect(data.success).toBe(true);
      expect(data.sessionToken).toBeDefined();
    });

    it('returns 401 when token is incorrect', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/network/qr-pair/create',
      });
      const created = createRes.json();

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/network/qr-pair/handshake',
        payload: {
          pairingId: created.pairingId,
          rawToken: 'invalid_raw_token_xyz',
        },
      });

      expect(res.statusCode).toBe(401);
    });
  });

  describe('POST /api/v1/network/companion/sync-progress', () => {
    it('synchronizes reading progress from companion reader', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/network/qr-pair/create',
      });
      const created = createRes.json();

      const handshakeRes = await app.inject({
        method: 'POST',
        url: '/api/v1/network/qr-pair/handshake',
        payload: {
          pairingId: created.pairingId,
          rawToken: created.rawToken,
          deviceName: 'Galaxy Tab S9',
          deviceType: 'tablet',
        },
      });
      const handshake = handshakeRes.json();

      const syncRes = await app.inject({
        method: 'POST',
        url: '/api/v1/network/companion/sync-progress',
        payload: {
          pairingId: created.pairingId,
          sessionToken: handshake.sessionToken,
          seriesId: 'chainsaw-man',
          chapterId: 'ch-90',
          pageNumber: 15,
        },
      });

      expect(syncRes.statusCode).toBe(200);
      expect(syncRes.json().success).toBe(true);

      // Verify active session state
      const sessionRes = await app.inject({
        method: 'GET',
        url: `/api/v1/network/companion/session/${created.pairingId}`,
      });
      expect(sessionRes.statusCode).toBe(200);
      const sessionData = sessionRes.json();
      expect(sessionData.session.activeSeriesId).toBe('chainsaw-man');
      expect(sessionData.session.activePageNumber).toBe(15);
    });
  });

  describe('GET /api/v1/network/companion/active-devices & POST revoke', () => {
    it('lists paired devices and revokes them', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/network/qr-pair/create',
      });
      const created = createRes.json();

      await app.inject({
        method: 'POST',
        url: '/api/v1/network/qr-pair/handshake',
        payload: {
          pairingId: created.pairingId,
          rawToken: created.rawToken,
          deviceName: 'Test Phone',
        },
      });

      const listRes = await app.inject({
        method: 'GET',
        url: '/api/v1/network/companion/active-devices',
      });
      expect(listRes.statusCode).toBe(200);
      expect(listRes.json().count).toBe(1);

      const revokeRes = await app.inject({
        method: 'POST',
        url: '/api/v1/network/companion/revoke',
        payload: {
          pairingId: created.pairingId,
        },
      });
      expect(revokeRes.statusCode).toBe(200);
      expect(revokeRes.json().success).toBe(true);
    });
  });
});
