import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../../src/backend/db/database.js';
import { spatialHeatmapRoutes } from '../../../../src/backend/routes/spatial-heatmap-routes.js';
import { SpatialHeatmapService } from '../../../../src/backend/services/spatial-heatmap-service.js';

describe('spatialHeatmapRoutes Fastify Endpoints (Sprint 61)', () => {
  let app: FastifyInstance;
  let db: DatabaseInstance;
  let service: SpatialHeatmapService;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    runMigrations(db);

    db.prepare(`
      INSERT INTO series (id, slug, title_primary, type, status)
      VALUES ('ser-sh', 'sh-manga', 'Spatial Heatmap Manga', 'manga', 'ongoing')
    `).run();

    db.prepare(`
      INSERT INTO chapters (id, series_id, chapter_number, title, storage_path, page_count)
      VALUES 
        ('ch-sh-1', 'ser-sh', 1, 'Ch 1', '/tmp/1.cbz', 20),
        ('ch-sh-2', 'ser-sh', 2, 'Ch 2', '/tmp/2.cbz', 20)
    `).run();

    service = new SpatialHeatmapService(db);

    app = Fastify();
    await app.register(spatialHeatmapRoutes, { db, spatialHeatmapService: service });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  describe('POST /api/v1/analytics/spatial-heatmap/record', () => {
    it('returns 400 when required fields are missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/analytics/spatial-heatmap/record',
        payload: { pageNumber: 1, dwellMs: 100 },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().message).toContain('chapterId');
    });

    it('records dwell event successfully', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/analytics/spatial-heatmap/record',
        payload: {
          chapterId: 'ch-sh-1',
          pageNumber: 1,
          userId: 'reader-1',
          dwellMs: 2500,
          focusType: 'BUBBLE',
          boundingBox: { x: 20, y: 30, w: 25, h: 15 },
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
    });
  });

  describe('GET /api/v1/analytics/spatial-heatmap/page', () => {
    it('returns 404 when heatmap not found', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/analytics/spatial-heatmap/page?chapterId=ch-sh-1&pageNumber=99&userId=unknown',
      });
      expect(res.statusCode).toBe(404);
    });

    it('returns 200 with 16x16 matrix when heatmap exists', async () => {
      // Record first
      await app.inject({
        method: 'POST',
        url: '/api/v1/analytics/spatial-heatmap/record',
        payload: {
          chapterId: 'ch-sh-1',
          pageNumber: 2,
          userId: 'reader-2',
          dwellMs: 3500,
          focusType: 'PANEL',
          boundingBox: { x: 10, y: 10, w: 50, h: 40 },
        },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/analytics/spatial-heatmap/page?chapterId=ch-sh-1&pageNumber=2&userId=reader-2',
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.success).toBe(true);
      expect(data.heatmap.gridDim).toBe(16);
      expect(data.heatmap.grid.length).toBe(256);
      expect(data.heatmap.matrix2D.length).toBe(16);
      expect(data.heatmap.matrix2D[0].length).toBe(16);
      expect(data.heatmap.totalDwellMs).toBe(3500);
    });
  });

  describe('POST /api/v1/analytics/spatial-heatmap/flush', () => {
    it('flushes dirty records and returns flushed count', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/v1/analytics/spatial-heatmap/record',
        payload: {
          chapterId: 'ch-sh-2',
          pageNumber: 1,
          userId: 'reader-3',
          dwellMs: 1200,
        },
      });

      const flushRes = await app.inject({
        method: 'POST',
        url: '/api/v1/analytics/spatial-heatmap/flush',
        payload: {},
      });

      expect(flushRes.statusCode).toBe(200);
      expect(flushRes.json().flushedCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GET /api/v1/analytics/spatial-heatmap/stats', () => {
    it('returns accumulator diagnostics', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/analytics/spatial-heatmap/stats',
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
      expect(res.json().stats).toHaveProperty('activeAccumulators');
      expect(res.json().stats).toHaveProperty('dirtyCount');
    });
  });
});
