/**
 * KuraScroll Sprint 94: Storage Tier Routes Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import { storageTierRoutes, computeStorageTierEtag } from '../../../../src/backend/routes/storage-tier-routes.js';
import { StorageTierService } from '../../../../src/backend/services/storage-tier-service.js';

describe('storageTierRoutes', () => {
  let app: FastifyInstance;
  let db: DatabaseInstance;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS storage_tier_profiles (
        series_id TEXT PRIMARY KEY,
        auto_tiering_mode TEXT NOT NULL DEFAULT 'balanced_hybrid' CHECK (auto_tiering_mode IN (
            'aggressive_evict',
            'balanced_hybrid',
            'archive_pin',
            'custom'
        )),
        hot_retention_days INTEGER NOT NULL DEFAULT 14 CHECK (hot_retention_days >= 1 AND hot_retention_days <= 180),
        warm_retention_days INTEGER NOT NULL DEFAULT 60 CHECK (warm_retention_days >= 7 AND warm_retention_days <= 365),
        disk_quota_target_gb INTEGER NOT NULL DEFAULT 3500 CHECK (disk_quota_target_gb >= 100 AND disk_quota_target_gb <= 4000),
        is_auto_eviction_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_auto_eviction_enabled IN (0, 1)),
        is_pinned INTEGER NOT NULL DEFAULT 0 CHECK (is_pinned IN (0, 1)),
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_storage_tier_lookup ON storage_tier_profiles(series_id);
    `);

    app = Fastify();
    await app.register(storageTierRoutes, {
      db,
      storageTierService: new StorageTierService(db),
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('GET /api/v1/reader/storage-tier/presets returns presets', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/storage-tier/presets',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.presets.aggressive_evict).toBeDefined();
    expect(body.presets.balanced_hybrid).toBeDefined();
    expect(body.presets.archive_pin).toBeDefined();
    expect(body.presets.custom).toBeDefined();
  });

  it('GET /api/v1/reader/storage-tier/profile/:seriesId returns default profile with ETag', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/storage-tier/profile/vinland-saga',
    });
    expect(res.statusCode).toBe(200);
    const etag = res.headers['etag'];
    expect(etag).toBeDefined();
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.profile.seriesId).toBe('vinland-saga');
    expect(body.profile.autoTieringMode).toBe('balanced_hybrid');
  });

  it('GET /api/v1/reader/storage-tier/profile/:seriesId returns 304 on matching ETag', async () => {
    const firstRes = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/storage-tier/profile/vinland-saga',
    });
    const etag = firstRes.headers['etag'] as string;

    const secondRes = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/storage-tier/profile/vinland-saga',
      headers: {
        'if-none-match': etag,
      },
    });
    expect(secondRes.statusCode).toBe(304);
  });

  it('POST /api/v1/reader/storage-tier/profile upserts and returns modified profile', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/storage-tier/profile',
      payload: {
        seriesId: 'vinland-saga',
        autoTieringMode: 'archive_pin',
        hotRetentionDays: 30,
        warmRetentionDays: 180,
        diskQuotaTargetGb: 3800,
        isAutoEvictionEnabled: false,
        isPinned: true,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.profile.autoTieringMode).toBe('archive_pin');
    expect(body.profile.isPinned).toBe(true);

    const getRes = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/storage-tier/profile/vinland-saga',
    });
    expect(getRes.json().profile.isPinned).toBe(true);
  });

  it('POST /api/v1/reader/storage-tier/calculate-tiering-plan returns evaluated plan', async () => {
    const nowMs = 1700000000000;
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/storage-tier/calculate-tiering-plan',
      payload: {
        candidates: [
          {
            chapterId: 'ch-1',
            seriesId: 'vinland-saga',
            sizeBytes: 20_000_000,
            lastReadAt: nowMs - (5 * 86400000),
            readCount: 5,
            isCompleted: false,
            isPinned: false,
            currentTier: 'tier_hot',
          },
        ],
        nowMs,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.plan.totalChaptersEvaluated).toBe(1);
    expect(body.plan.hotCount).toBe(1);
  });

  it('POST /api/v1/reader/storage-tier/profile rejects empty seriesId', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/storage-tier/profile',
      payload: {
        seriesId: '',
      },
    });
    expect(res.statusCode).toBe(400);
  });
});
