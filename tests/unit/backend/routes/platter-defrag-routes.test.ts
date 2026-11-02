import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../../src/backend/db/database.js';
import { platterDefragRoutes } from '../../../../src/backend/routes/platter-defrag-routes.js';
import { PlatterDefragService } from '../../../../src/backend/services/platter-defrag-service.js';

describe('platterDefragRoutes Fastify Endpoints (Sprint 63)', () => {
  let app: FastifyInstance;
  let db: DatabaseInstance;
  let service: PlatterDefragService;
  let testDir: string;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    runMigrations(db);

    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'platter-routes-test-'));

    db.prepare(`
      INSERT INTO series (id, slug, title_primary, type, status)
      VALUES ('ser-defrag-route', 'route-series', 'Route Series', 'manga', 'ongoing')
    `).run();

    service = new PlatterDefragService(db);

    app = Fastify();
    await app.register(platterDefragRoutes, { db, defragService: service });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch {}
  });

  describe('GET /api/v1/storage/platter/pli', () => {
    it('returns 400 when seriesId is missing or empty', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/storage/platter/pli',
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().message).toContain('seriesId');
    });

    it('returns 200 with PlatterLocalityReport for valid seriesId', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/storage/platter/pli?seriesId=ser-defrag-route',
      });
      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.report).toBeDefined();
      expect(data.report.seriesId).toBe('ser-defrag-route');
      expect(data.report.pli).toBe(1.0);
      expect(data.report.isFragmented).toBe(false);
    });
  });

  describe('POST /api/v1/storage/platter/optimize', () => {
    it('returns 400 when seriesId is omitted', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/storage/platter/optimize',
        payload: {},
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().message).toContain('seriesId');
    });

    it('returns 200 and optimizes series platter layout', async () => {
      const chapPath = path.join(testDir, 'chap1.cbz');
      fs.writeFileSync(chapPath, Buffer.alloc(16 * 1024, 0x11));

      db.prepare(`
        INSERT INTO chapters (id, series_id, chapter_number, title, storage_path, page_count)
        VALUES ('chap-opt-1', 'ser-defrag-route', 1, 'Ch 1', ?, 5)
      `).run(chapPath);

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/storage/platter/optimize',
        payload: {
          seriesId: 'ser-defrag-route',
        },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.result.seriesId).toBe('ser-defrag-route');
      expect(data.result.chaptersProcessed).toBe(1);
      expect(data.result.bytesReordered).toBe(16 * 1024);
      expect(data.result.optimizedPli).toBeGreaterThanOrEqual(0.95);
    });
  });

  describe('GET /api/v1/storage/platter/history', () => {
    it('returns 200 with history array', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/storage/platter/history',
      });
      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.history)).toBe(true);
    });
  });

  describe('GET /api/v1/storage/platter/stats', () => {
    it('returns 200 with lifetime defrag stats', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/storage/platter/stats',
      });
      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.stats).toHaveProperty('totalRuns');
      expect(data.stats).toHaveProperty('totalBytesOptimized');
      expect(data.stats).toHaveProperty('avgPliImprovement');
    });
  });
});
