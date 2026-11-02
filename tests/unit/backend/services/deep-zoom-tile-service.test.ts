import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createDatabase,
  runMigrations,
  DatabaseInstance,
} from '../../../../src/backend/db/database.js';
import {
  DeepZoomTileService,
  computePyramidLevels,
  selectPyramidLevel,
  calculateVisibleTiles,
  DeepZoomManifest,
  ViewportTransform,
} from '../../../../src/backend/services/deep-zoom-tile-service.js';
import fs from 'node:fs';
import path from 'node:path';

describe('DeepZoomTileService & AABB LOD Engine (Sprint 66)', () => {
  let db: DatabaseInstance;
  let service: DeepZoomTileService;
  const testCacheDir = path.resolve('./data/cache/test_tiles_sprint66');

  beforeEach(() => {
    db = createDatabase(':memory:');
    runMigrations(db);

    service = new DeepZoomTileService({
      db,
      cacheRoot: testCacheDir,
      defaultTileSize: 512,
    });
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(testCacheDir)) {
      fs.rmSync(testCacheDir, { recursive: true, force: true });
    }
  });

  describe('computePyramidLevels', () => {
    it('returns single level and isPyramidal = false for pages <= 2048px (GMA 4500MHD texture fit)', () => {
      const res = computePyramidLevels(1200, 1800, 512);
      expect(res.isPyramidal).toBe(false);
      expect(res.maxLevel).toBe(0);
      expect(res.totalTiles).toBe(1);
      expect(res.levels).toHaveLength(1);
      expect(res.levels[0]).toEqual({
        level: 0,
        width: 1200,
        height: 1800,
        cols: 1,
        rows: 1,
        scale: 1.0,
      });
    });

    it('generates multi-level pyramid for massive double-spreads (e.g. 6000x4000)', () => {
      const res = computePyramidLevels(6000, 4000, 512);
      expect(res.isPyramidal).toBe(true);
      expect(res.maxLevel).toBe(4); // ceil(log2(6000/512)) = ceil(3.55) = 4
      expect(res.levels).toHaveLength(5); // levels 0, 1, 2, 3, 4

      // Level 4 (native 1:1)
      const topLevel = res.levels[4];
      expect(topLevel.width).toBe(6000);
      expect(topLevel.height).toBe(4000);
      expect(topLevel.cols).toBe(12); // ceil(6000/512) = 12
      expect(topLevel.rows).toBe(8); // ceil(4000/512) = 8

      // Level 0 (overview)
      const baseLevel = res.levels[0];
      expect(baseLevel.scale).toBeCloseTo(1 / 16, 4);
      expect(baseLevel.width).toBe(375);
      expect(baseLevel.height).toBe(250);
      expect(baseLevel.cols).toBe(1);
      expect(baseLevel.rows).toBe(1);
    });

    it('handles non-square webtoon aspect ratio gracefully (e.g. 1600x12000)', () => {
      const res = computePyramidLevels(1600, 12000, 512);
      expect(res.isPyramidal).toBe(true);
      expect(res.maxLevel).toBe(5); // ceil(log2(12000/512)) = 5
      expect(res.levels[5].height).toBe(12000);
      expect(res.levels[5].width).toBe(1600);
    });
  });

  describe('selectPyramidLevel', () => {
    it('always selects level 0 for non-pyramidal images', () => {
      expect(selectPyramidLevel(1.0, 0, false)).toBe(0);
      expect(selectPyramidLevel(3.0, 0, false)).toBe(0);
    });

    it('adapts LOD based on viewport zoom scale for pyramidal spreads', () => {
      const maxLevel = 4;
      // Normal overview scale 1.0 -> maxLevel - 1 = 3
      expect(selectPyramidLevel(1.0, maxLevel, true)).toBe(3);
      // Zoom in scale 2.0+ -> maxLevel = 4
      expect(selectPyramidLevel(2.0, maxLevel, true)).toBe(4);
      expect(selectPyramidLevel(4.0, maxLevel, true)).toBe(4);
      // Zoom out scale 0.5 -> maxLevel - 2 = 2
      expect(selectPyramidLevel(0.5, maxLevel, true)).toBe(2);
    });
  });

  describe('calculateVisibleTiles (AABB Viewport LOD)', () => {
    const mockManifest: DeepZoomManifest = {
      chapterId: 'ch_test_sprint66',
      pageNumber: 1,
      isPyramidal: true,
      originalWidth: 6000,
      originalHeight: 4000,
      tileSize: 512,
      overlap: 0,
      format: 'webp',
      maxLevel: 4,
      totalTiles: 147,
      levels: [
        { level: 0, width: 375, height: 250, cols: 1, rows: 1, scale: 0.0625 },
        { level: 1, width: 750, height: 500, cols: 2, rows: 1, scale: 0.125 },
        { level: 2, width: 1500, height: 1000, cols: 3, rows: 2, scale: 0.25 },
        { level: 3, width: 3000, height: 2000, cols: 6, rows: 4, scale: 0.5 },
        { level: 4, width: 6000, height: 4000, cols: 12, rows: 8, scale: 1.0 },
      ],
      createdAt: Date.now(),
    };

    it('calculates visible tiles within 1080p viewport at normal scale', () => {
      const transform: ViewportTransform = {
        panX: 0,
        panY: 0,
        scale: 1.0,
        viewportWidth: 1920,
        viewportHeight: 1080,
      };

      const result = calculateVisibleTiles(transform, mockManifest);
      expect(result.level).toBe(3); // Level 3 at scale 1.0
      expect(result.totalVisible).toBeGreaterThan(0);
      expect(result.totalVisible).toBeLessThanOrEqual(24);
      expect(result.vramBytesEstimated).toBeLessThanOrEqual(32 * 1024 * 1024);
      expect(result.isClamped).toBe(false);

      // Verify tile URLs are canonically formatted
      expect(result.tiles[0].url).toContain('/api/v1/tiles/ch_test_sprint66/1/3/');
    });

    it('bounds visible tiles during high zoom (scale 3.0) and pan offset', () => {
      const transform: ViewportTransform = {
        panX: -1500,
        panY: -1000,
        scale: 3.0,
        viewportWidth: 1280,
        viewportHeight: 720,
      };

      const result = calculateVisibleTiles(transform, mockManifest);
      expect(result.level).toBe(4); // Max level at 3x zoom
      expect(result.totalVisible).toBeGreaterThan(0);
      expect(result.totalVisible).toBeLessThanOrEqual(20);

      // Make sure tiles have coordinates in range
      for (const tile of result.tiles) {
        expect(tile.col).toBeGreaterThanOrEqual(0);
        expect(tile.col).toBeLessThan(12);
        expect(tile.row).toBeGreaterThanOrEqual(0);
        expect(tile.row).toBeLessThan(8);
      }
    });

    it('handles negative pan or offscreen coordinates without throwing', () => {
      const transform: ViewportTransform = {
        panX: -100000,
        panY: -100000,
        scale: 1.0,
        viewportWidth: 1000,
        viewportHeight: 1000,
      };

      const result = calculateVisibleTiles(transform, mockManifest);
      expect(result.tiles).toHaveLength(0);
      expect(result.totalVisible).toBe(0);
    });
  });

  describe('DeepZoomTileService Manifest Persistence & Tile Serving', () => {
    it('registers and retrieves manifest from SQLite database', () => {
      const registered = service.registerOrGetManifest('ch_berserk_83', 12, 5400, 3600);
      expect(registered.chapterId).toBe('ch_berserk_83');
      expect(registered.pageNumber).toBe(12);
      expect(registered.isPyramidal).toBe(true);

      const retrieved = service.getManifest('ch_berserk_83', 12);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.originalWidth).toBe(5400);
      expect(retrieved?.originalHeight).toBe(3600);
      expect(retrieved?.levels.length).toBe(registered.levels.length);
    });

    it('returns null for unregistered manifest', () => {
      const result = service.getManifest('nonexistent', 99);
      expect(result).toBeNull();
    });

    it('generates, caches and returns WebP tile with valid ETag', async () => {
      service.registerOrGetManifest('ch_berserk_83', 1, 4000, 3000);

      const tile1 = await service.getTile('ch_berserk_83', 1, 0, 0, 0);
      expect(tile1.contentType).toBe('image/webp');
      expect(tile1.buffer.length).toBeGreaterThan(0);
      expect(tile1.etag).toMatch(/^"[a-f0-9]{32}"$/);

      // Subsequent call should hit cache and return identical ETag
      const tile2 = await service.getTile('ch_berserk_83', 1, 0, 0, 0);
      expect(tile2.etag).toBe(tile1.etag);
      expect(tile2.buffer.length).toBe(tile1.buffer.length);
    });
  });
});
