import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fastify, { FastifyInstance } from 'fastify';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import { cloudlessSyncRoutes } from '../../../../src/backend/routes/cloudless-sync-routes.js';
import { CloudlessSyncService } from '../../../../src/backend/services/cloudless-sync-service.js';

describe('CloudlessSyncRoutes (Sprint 85)', () => {
  let app: FastifyInstance;
  let db: DatabaseInstance;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS sync_milestone_profiles (
        series_id TEXT NOT NULL,
        user_id TEXT NOT NULL DEFAULT 'default_user',
        device_id TEXT NOT NULL,
        vector_clock INTEGER NOT NULL DEFAULT 1,
        chapters_completed INTEGER NOT NULL DEFAULT 0,
        total_reading_seconds INTEGER NOT NULL DEFAULT 0,
        streak_days INTEGER NOT NULL DEFAULT 1,
        sync_mode TEXT NOT NULL DEFAULT 'local_broadcast' CHECK (sync_mode IN ('local_broadcast', 'p2p_direct', 'offline_vault')),
        is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (series_id, user_id, device_id)
      );
    `);

    app = fastify();
    await app.register(cloudlessSyncRoutes, {
      db,
      cloudlessSyncService: new CloudlessSyncService(db),
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('GET /api/v1/reader/cloudless-sync/modes returns supported sync modes', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/cloudless-sync/modes',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.modes).toHaveProperty('local_broadcast');
    expect(body.modes).toHaveProperty('p2p_direct');
    expect(body.modes).toHaveProperty('offline_vault');
  });

  it('GET /api/v1/reader/cloudless-sync/milestone/:seriesId returns profile with ETag', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/cloudless-sync/milestone/series-monster',
    });

    expect(res.statusCode).toBe(200);
    const etag = res.headers['etag'];
    expect(etag).toBeDefined();

    // Re-request with If-None-Match to verify 304 Not Modified
    const cachedRes = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/cloudless-sync/milestone/series-monster',
      headers: {
        'if-none-match': etag as string,
      },
    });

    expect(cachedRes.statusCode).toBe(304);
  });

  it('POST /api/v1/reader/cloudless-sync/milestone validates and saves milestone', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/cloudless-sync/milestone',
      payload: {
        seriesId: 'series-dungeon-meshi',
        userId: 'carlos',
        deviceId: 'carlos_phone',
        vectorClock: 15,
        chaptersCompleted: 50,
        totalReadingSeconds: 12000,
        streakDays: 14,
        syncMode: 'local_broadcast',
        isEnabled: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.profile.seriesId).toBe('series-dungeon-meshi');
    expect(body.profile.chaptersCompleted).toBe(50);
  });

  it('POST /api/v1/reader/cloudless-sync/reconcile-peer merges peer progress', async () => {
    // Seed initial local profile
    await app.inject({
      method: 'POST',
      url: '/api/v1/reader/cloudless-sync/milestone',
      payload: {
        seriesId: 'series-pluto',
        userId: 'carlos',
        deviceId: 'carlos_pc',
        vectorClock: 5,
        chaptersCompleted: 8,
        totalReadingSeconds: 2000,
      },
    });

    // Reconcile with remote peer that has advanced further
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/cloudless-sync/reconcile-peer',
      payload: {
        seriesId: 'series-pluto',
        userId: 'carlos',
        remoteState: {
          deviceId: 'carlos_tablet',
          vectorClock: 9,
          chaptersCompleted: 16,
          totalReadingSeconds: 4000,
          timestamp: Date.now() + 500,
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.profile.vectorClock).toBe(10);
    expect(body.profile.chaptersCompleted).toBe(16);
  });

  it('rejects requests with missing seriesId with 400 Bad Request', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/cloudless-sync/milestone',
      payload: {
        chaptersCompleted: 10,
      },
    });

    expect(res.statusCode).toBe(400);
  });
});
