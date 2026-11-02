import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../../src/backend/db/database.js';
import {
  SpatialHeatmapService,
  GRID_DIM,
  TOTAL_CELLS,
} from '../../../../src/backend/services/spatial-heatmap-service.js';

describe('SpatialHeatmapService (Sprint 61)', () => {
  let db: DatabaseInstance;
  let service: SpatialHeatmapService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    runMigrations(db);

    // Seed dummy series and chapters
    db.prepare(`
      INSERT INTO series (id, slug, title_primary, type, status)
      VALUES ('ser-test', 'test-manga', 'Test Manga', 'manga', 'ongoing')
    `).run();

    db.prepare(`
      INSERT INTO chapters (id, series_id, chapter_number, title, storage_path, page_count)
      VALUES 
        ('chap-101', 'ser-test', 1, 'Chapter 1', '/path/1.cbz', 20),
        ('chap-102', 'ser-test', 2, 'Chapter 2', '/path/2.cbz', 20)
    `).run();

    service = new SpatialHeatmapService(db);
  });

  afterEach(() => {
    db.close();
  });

  it('records bounding box dwell events and projects onto 16x16 grid', () => {
    service.recordDwellEvent({
      chapterId: 'chap-101',
      pageNumber: 1,
      userId: 'user-a',
      dwellMs: 2000,
      focusType: 'BUBBLE',
      boundingBox: { x: 50, y: 50, w: 20, h: 20 }, // Center-right area
    });

    const heatmap = service.getPageHeatmap('chap-101', 1, 'user-a');
    expect(heatmap).not.toBeNull();
    expect(heatmap?.gridDim).toBe(16);
    expect(heatmap?.totalDwellMs).toBe(2000);
    expect(heatmap?.peakIntensity).toBeGreaterThan(0);
    expect(heatmap?.grid.length).toBe(256);

    // Verify center cells have attention while corner (0,0) is zero
    expect(heatmap?.matrix2D[0][0]).toBe(0);
    expect(heatmap?.matrix2D[8][8]).toBeGreaterThan(0);
  });

  it('records kinetic point focus with 3x3 kernel projection', () => {
    service.recordDwellEvent({
      chapterId: 'chap-101',
      pageNumber: 2,
      userId: 'user-b',
      dwellMs: 1500,
      focusType: 'KINETIC_POINT',
      point: { x: 25, y: 25 }, // cell (4, 4)
    });

    const heatmap = service.getPageHeatmap('chap-101', 2, 'user-b');
    expect(heatmap).not.toBeNull();
    expect(heatmap?.totalDwellMs).toBe(1500);

    // Cell (4, 4) should have highest weight in kernel
    const centerVal = heatmap?.matrix2D[4][4] ?? 0;
    const neighborVal = heatmap?.matrix2D[4][5] ?? 0;
    const diagonalVal = heatmap?.matrix2D[3][3] ?? 0;
    const farVal = heatmap?.matrix2D[0][0] ?? 0;

    expect(centerVal).toBeGreaterThan(neighborVal);
    expect(neighborVal).toBeGreaterThan(diagonalVal);
    expect(diagonalVal).toBeGreaterThan(farVal);
    expect(farVal).toBe(0);
  });

  it('records global uniform dwell across all 256 cells', () => {
    service.recordDwellEvent({
      chapterId: 'chap-101',
      pageNumber: 3,
      userId: 'user-c',
      dwellMs: 5000,
      focusType: 'GLOBAL',
    });

    const heatmap = service.getPageHeatmap('chap-101', 3, 'user-c');
    expect(heatmap).not.toBeNull();
    expect(heatmap?.totalDwellMs).toBe(5000);

    // All cells should have non-zero value
    for (let r = 0; r < GRID_DIM; r++) {
      for (let c = 0; c < GRID_DIM; c++) {
        expect(heatmap?.matrix2D[r][c]).toBeGreaterThan(0);
      }
    }
  });

  it('flushes in-memory accumulators to SQLite BLOB storage via write-behind batching', () => {
    service.recordDwellEvent({
      chapterId: 'chap-101',
      pageNumber: 1,
      userId: 'user-1',
      dwellMs: 3000,
      boundingBox: { x: 10, y: 10, w: 20, h: 20 },
    });

    service.recordDwellEvent({
      chapterId: 'chap-102',
      pageNumber: 1,
      userId: 'user-2',
      dwellMs: 4000,
      boundingBox: { x: 70, y: 70, w: 20, h: 20 },
    });

    let stats = service.getStats();
    expect(stats.activeAccumulators).toBe(2);
    expect(stats.dirtyCount).toBe(2);

    const flushed = service.flushBuffer();
    expect(flushed).toBe(2);

    stats = service.getStats();
    expect(stats.dirtyCount).toBe(0);

    // Verify row exists directly in SQLite
    const row = db.prepare(`
      SELECT total_dwell_ms, peak_intensity, LENGTH(heatmap_blob) as blob_len
      FROM page_spatial_heatmaps
      WHERE chapter_id = 'chap-101' AND page_number = 1 AND user_id = 'user-1'
    `).get() as { total_dwell_ms: number; peak_intensity: number; blob_len: number };

    expect(row).toBeDefined();
    expect(row.total_dwell_ms).toBe(3000);
    expect(row.blob_len).toBe(256);

    // Clearing memory cache and fetching should read back from SQLite
    service.clearMemoryCache();
    const fetchedAfterClear = service.getPageHeatmap('chap-101', 1, 'user-1');
    expect(fetchedAfterClear).not.toBeNull();
    expect(fetchedAfterClear?.totalDwellMs).toBe(3000);
    expect(fetchedAfterClear?.peakIntensity).toBe(row.peak_intensity);
  });

  it('aggregates multi-user heatmaps into community focus overlay', () => {
    // User A looks at top-left
    service.recordDwellEvent({
      chapterId: 'chap-101',
      pageNumber: 5,
      userId: 'reader-a',
      dwellMs: 4000,
      boundingBox: { x: 5, y: 5, w: 20, h: 20 },
    });

    // User B looks at bottom-right
    service.recordDwellEvent({
      chapterId: 'chap-101',
      pageNumber: 5,
      userId: 'reader-b',
      dwellMs: 6000,
      boundingBox: { x: 75, y: 75, w: 20, h: 20 },
    });

    service.flushBuffer();

    const aggregate = service.getPageAggregateHeatmap('chap-101', 5);
    expect(aggregate).not.toBeNull();
    expect(aggregate?.userId).toBe('community_aggregate');
    expect(aggregate?.totalDwellMs).toBe(10000);

    // Both top-left and bottom-right should have intensity
    expect(aggregate?.matrix2D[1][1]).toBeGreaterThan(0);
    expect(aggregate?.matrix2D[13][13]).toBeGreaterThan(0);
  });

  it('returns null when querying non-existent heatmap', () => {
    const res = service.getPageHeatmap('chap-999', 99, 'nobody');
    expect(res).toBeNull();
  });
});
