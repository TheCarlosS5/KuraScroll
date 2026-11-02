import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import {
  createDatabase,
  runMigrations,
  DatabaseInstance,
} from '../../../../src/backend/db/database.js';
import { storageVaultRoutes } from '../../../../src/backend/routes/storage-vault-routes.js';
import { StorageVaultService } from '../../../../src/backend/services/storage-vault-service.js';

describe('storageVaultRoutes Fastify Endpoints (Sprint 72)', () => {
  let app: FastifyInstance;
  let db: DatabaseInstance;
  let service: StorageVaultService;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    runMigrations(db);

    service = new StorageVaultService(db);

    app = Fastify();
    await app.register(storageVaultRoutes, { db, storageVaultService: service });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  describe('GET /api/v1/vault/inventory/:userId', () => {
    it('returns empty inventory with valid ETag for new user', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/vault/inventory/user_test_1',
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.count).toBe(0);
      expect(data.inventory).toEqual([]);

      const etag = res.headers['etag'];
      expect(etag).toBeDefined();

      const secondRes = await app.inject({
        method: 'GET',
        url: '/api/v1/vault/inventory/user_test_1',
        headers: {
          'if-none-match': etag as string,
        },
      });
      expect(secondRes.statusCode).toBe(304);
    });

    it('returns 400 when userId is whitespace or empty', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/vault/inventory/%20',
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /api/v1/vault/register', () => {
    it('registers a downloaded chapter successfully', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/vault/register',
        payload: {
          userId: 'user_test_1',
          seriesId: 'series_sololeveling',
          chapterId: 'chap_10',
          chapterNumber: 10,
          seriesTitle: 'Solo Leveling',
          totalBytes: 35000000,
          totalPages: 32,
          isPinned: false,
          isUnread: true,
          isFavorite: true,
          lastAccessedAt: Date.now(),
          downloadedAt: Date.now(),
        },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.chapter.chapterId).toBe('chap_10');
      expect(data.chapter.totalBytes).toBe(35000000);
    });

    it('returns 400 when required fields are missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/vault/register',
        payload: {
          userId: 'user_test_1',
          // chapterId missing
          totalBytes: 12345,
        },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /api/v1/vault/pin', () => {
    it('toggles pin status on registered chapter', async () => {
      // First register
      await app.inject({
        method: 'POST',
        url: '/api/v1/vault/register',
        payload: {
          userId: 'user_test_pin',
          seriesId: 's1',
          chapterId: 'c1',
          chapterNumber: 1,
          seriesTitle: 'One Piece',
          totalBytes: 15000000,
          totalPages: 18,
          isPinned: false,
          isUnread: true,
          isFavorite: false,
          lastAccessedAt: Date.now(),
          downloadedAt: Date.now(),
        },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/vault/pin',
        payload: {
          userId: 'user_test_pin',
          chapterId: 'c1',
        },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.isPinned).toBe(true);
    });

    it('returns 400 if userId or chapterId is missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/vault/pin',
        payload: {
          userId: 'user_test_pin',
        },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /api/v1/vault/evict', () => {
    it('triggers evaluation and eviction when space exceeds threshold', async () => {
      // Set small quota
      await app.inject({
        method: 'PUT',
        url: '/api/v1/vault/policy',
        payload: {
          userId: 'user_evict_api',
          maxQuotaBytes: 100 * 1024 * 1024,
          highWatermarkPct: 0.70, // 70MB
          lowWatermarkPct: 0.50, // 50MB
          autoEvictEnabled: true,
        },
      });

      // Add chapter: 60MB
      await app.inject({
        method: 'POST',
        url: '/api/v1/vault/register',
        payload: {
          userId: 'user_evict_api',
          seriesId: 's1',
          chapterId: 'c_large',
          chapterNumber: 1,
          seriesTitle: 'Manga Large',
          totalBytes: 60 * 1024 * 1024,
          totalPages: 40,
          isPinned: false,
          isUnread: false,
          isFavorite: false,
          lastAccessedAt: Date.now() - 100000,
          downloadedAt: Date.now() - 100000,
        },
      });

      // Request requiring 20MB -> 60 + 20 = 80MB > 70MB -> should evict c_large
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/vault/evict',
        payload: {
          userId: 'user_evict_api',
          requiredBytes: 20 * 1024 * 1024,
        },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.evictedChapters).toContain('c_large');
      expect(data.bytesFreed).toBe(60 * 1024 * 1024);
    });
  });

  describe('GET /api/v1/vault/status/:userId & Policies', () => {
    it('retrieves vault status summary', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/vault/status/user_status_test',
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.status.totalChapters).toBe(0);
      expect(data.status.totalBytesUsed).toBe(0);
      expect(data.status.maxQuotaBytes).toBeGreaterThan(0);
    });

    it('retrieves and updates user quota policy', async () => {
      const getRes = await app.inject({
        method: 'GET',
        url: '/api/v1/vault/policy/user_policy_test',
      });

      expect(getRes.statusCode).toBe(200);
      const getPolicy = getRes.json().policy;
      expect(getPolicy.userId).toBe('user_policy_test');

      const putRes = await app.inject({
        method: 'PUT',
        url: '/api/v1/vault/policy',
        payload: {
          userId: 'user_policy_test',
          maxQuotaBytes: 500 * 1024 * 1024,
          highWatermarkPct: 0.85,
          lowWatermarkPct: 0.60,
          autoEvictEnabled: true,
        },
      });

      expect(putRes.statusCode).toBe(200);
      const putData = putRes.json();
      expect(putData.success).toBe(true);
      expect(putData.policy.maxQuotaBytes).toBe(500 * 1024 * 1024);
      expect(putData.policy.highWatermarkPct).toBe(0.85);
    });
  });

  describe('DELETE /api/v1/vault/chapter/:userId/:chapterId', () => {
    it('deletes registered chapter from vault', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/v1/vault/register',
        payload: {
          userId: 'user_del_test',
          seriesId: 's1',
          chapterId: 'c_del',
          chapterNumber: 1,
          seriesTitle: 'Manga Delete',
          totalBytes: 5000000,
          totalPages: 10,
          isPinned: false,
          isUnread: false,
          isFavorite: false,
          lastAccessedAt: Date.now(),
          downloadedAt: Date.now(),
        },
      });

      const delRes = await app.inject({
        method: 'DELETE',
        url: '/api/v1/vault/chapter/user_del_test/c_del',
      });

      expect(delRes.statusCode).toBe(200);
      expect(delRes.json().success).toBe(true);

      const statusRes = await app.inject({
        method: 'GET',
        url: '/api/v1/vault/status/user_del_test',
      });
      expect(statusRes.json().status.totalChapters).toBe(0);
    });
  });
});
