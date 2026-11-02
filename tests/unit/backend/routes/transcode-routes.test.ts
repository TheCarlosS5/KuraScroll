import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../../src/backend/db/database.js';
import { TranscodeCacheService } from '../../../../src/backend/services/transcode-cache-service.js';
import { transcodeRoutes } from '../../../../src/backend/routes/transcode-routes.js';

describe('Sprint 58 - TranscodeRoutes Fastify Integration', () => {
  let app: FastifyInstance;
  let db: DatabaseInstance;
  let service: TranscodeCacheService;
  let tmpDir: string;
  let dummyImagePath: string;

  const dummyImageBytes = Buffer.from('WEBP_IMAGE_RAW_CACHE_DATA_SAMPLE', 'utf8');

  beforeEach(async () => {
    db = createDatabase(':memory:');
    runMigrations(db);

    db.prepare(`
      INSERT INTO series (id, slug, title_primary, type, status)
      VALUES ('ser_route', 'route-series', 'Route Series', 'manga', 'ongoing')
    `).run();

    tmpDir = path.join(os.tmpdir(), `kura_route_tc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
    await fs.mkdir(tmpDir, { recursive: true });

    dummyImagePath = path.join(tmpDir, 'page1_1200.webp');
    await fs.writeFile(dummyImagePath, dummyImageBytes);

    db.prepare(`
      INSERT INTO chapters (id, series_id, chapter_number, title, storage_path, page_count)
      VALUES ('ch_route_1', 'ser_route', 1, 'Chapter 1', ?, 5)
    `).run(dummyImagePath);

    service = new TranscodeCacheService(db, tmpDir);

    // Pre-seed cached record
    service.recordCachedPage({
      id: 'rec_seeded_1',
      chapterId: 'ch_route_1',
      pageNumber: 1,
      targetWidth: 1200,
      targetHeight: 1700,
      filePath: dummyImagePath,
      fileSizeBytes: dummyImageBytes.length,
      quality: 80,
      etag: '"seeded_etag_123"',
    });

    app = Fastify();
    await app.register(transcodeRoutes, { db, transcodeCacheService: service });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('rejects invalid page numbers with 400 Bad Request', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/chapters/ch_route_1/pages/-1/transcode',
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error).toBe('INVALID_PAGE_NUMBER');
  });

  it('returns 404 for unknown chapter id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/chapters/ch_nonexistent/pages/1/transcode',
    });

    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.error).toBe('CHAPTER_NOT_FOUND');
  });

  it('serves cached WebP page with 200 OK, ETag, and Cache HIT headers', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/chapters/ch_route_1/pages/1/transcode?w=1200',
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('image/webp');
    expect(res.headers['etag']).toBe('"seeded_etag_123"');
    expect(res.headers['x-kura-transcode-cache']).toBe('HIT');
    expect(res.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    expect(res.rawPayload.equals(dummyImageBytes)).toBe(true);
  });

  it('returns HTTP 304 Not Modified when client sends matching If-None-Match ETag', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/chapters/ch_route_1/pages/1/transcode?w=1200',
      headers: {
        'if-none-match': '"seeded_etag_123"',
      },
    });

    expect(res.statusCode).toBe(304);
    expect(res.payload).toBe('');
    expect(res.headers['etag']).toBe('"seeded_etag_123"');
  });

  it('GET /api/v1/cache/transcode/stats returns cache metrics', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/cache/transcode/stats',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.totalCachedPages).toBe(1);
    expect(body.data.totalSizeBytes).toBe(dummyImageBytes.length);
    expect(body.data.quotaBytes).toBeGreaterThan(0);
  });

  it('POST /api/v1/cache/transcode/prune executes manual pruning check', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/cache/transcode/prune',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.prunedCount).toBe(0); // Quota not exceeded
  });
});
