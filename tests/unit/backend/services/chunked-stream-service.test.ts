/**
 * KuraScroll Sprint 87: Progressive Image Decompression & Chunked Bitstream Service Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import {
  ChunkedStreamService,
  CHUNKED_STREAM_PRESETS,
  ChunkedStreamProfile,
} from '../../../../src/backend/services/chunked-stream-service.js';

describe('ChunkedStreamService', () => {
  let db: DatabaseInstance;
  let service: ChunkedStreamService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS chunked_stream_profiles (
        series_id TEXT PRIMARY KEY,
        chunk_height_px INTEGER NOT NULL DEFAULT 1024 CHECK (chunk_height_px >= 256 AND chunk_height_px <= 2048),
        bitstream_quality INTEGER NOT NULL DEFAULT 80 CHECK (bitstream_quality >= 30 AND bitstream_quality <= 100),
        progressive_pass_count INTEGER NOT NULL DEFAULT 2 CHECK (progressive_pass_count >= 1 AND progressive_pass_count <= 4),
        idle_slice_budget_ms REAL NOT NULL DEFAULT 8.0 CHECK (idle_slice_budget_ms >= 1.0 AND idle_slice_budget_ms <= 16.0),
        is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_chunked_stream_lookup ON chunked_stream_profiles(series_id);
    `);
    service = new ChunkedStreamService(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('calculateImageChunkSlices', () => {
    it('returns empty slices on zero or negative dimensions', () => {
      const res1 = service.calculateImageChunkSlices(0, 0);
      expect(res1.totalSlices).toBe(0);
      expect(res1.slices).toEqual([]);
      expect(res1.isOversized).toBe(false);

      const res2 = service.calculateImageChunkSlices(-100, 500);
      expect(res2.totalSlices).toBe(0);
    });

    it('returns single slice for image within chunk boundary (e.g., 800x600)', () => {
      const res = service.calculateImageChunkSlices(800, 600, 1024);
      expect(res.rows).toBe(1);
      expect(res.cols).toBe(1);
      expect(res.totalSlices).toBe(1);
      expect(res.slices[0]).toEqual({
        index: 0,
        row: 0,
        col: 0,
        x: 0,
        y: 0,
        width: 800,
        height: 600,
        aspectRatio: 1.3333,
        byteEstimate: 800 * 600 * 4,
      });
      expect(res.isOversized).toBe(false);
    });

    it('slices tall webtoon strip (1440x8000) into 16 slices', () => {
      // 1440 width => 2 cols of max 1024 (col 0: 1024, col 1: 416)
      // 8000 height => 8 rows of max 1024 (rows 0-6: 1024, row 7: 832)
      // totalSlices = 2 * 8 = 16
      const res = service.calculateImageChunkSlices(1440, 8000, 1024);
      expect(res.cols).toBe(2);
      expect(res.rows).toBe(8);
      expect(res.totalSlices).toBe(16);
      expect(res.isOversized).toBe(true);

      // Verify first slice
      expect(res.slices[0]).toEqual({
        index: 0,
        row: 0,
        col: 0,
        x: 0,
        y: 0,
        width: 1024,
        height: 1024,
        aspectRatio: 1.0,
        byteEstimate: 1024 * 1024 * 4,
      });

      // Verify top-right slice
      expect(res.slices[1]).toEqual({
        index: 1,
        row: 0,
        col: 1,
        x: 1024,
        y: 0,
        width: 416,
        height: 1024,
        aspectRatio: parseFloat((416 / 1024).toFixed(4)),
        byteEstimate: 416 * 1024 * 4,
      });

      // Verify bottom-right slice
      const lastSlice = res.slices[15];
      expect(lastSlice.row).toBe(7);
      expect(lastSlice.col).toBe(1);
      expect(lastSlice.x).toBe(1024);
      expect(lastSlice.y).toBe(7168);
      expect(lastSlice.width).toBe(416);
      expect(lastSlice.height).toBe(832);
      expect(lastSlice.byteEstimate).toBe(416 * 832 * 4);
    });

    it('respects custom byte-per-pixel estimates', () => {
      const res = service.calculateImageChunkSlices(1000, 1000, 1000, 2); // 2 bytes per pixel
      expect(res.totalByteEstimate).toBe(1000 * 1000 * 2);
    });
  });

  describe('getProfile and setProfile', () => {
    it('returns default profile when not found in DB', () => {
      const prof = service.getProfile('series-webtoon-1');
      expect(prof.seriesId).toBe('series-webtoon-1');
      expect(prof.chunkHeightPx).toBe(CHUNKED_STREAM_PRESETS.webtoon_conservative.chunkHeightPx);
      expect(prof.bitstreamQuality).toBe(80);
      expect(prof.progressivePassCount).toBe(2);
      expect(prof.idleSliceBudgetMs).toBe(8.0);
      expect(prof.isEnabled).toBe(true);
      expect(prof.updatedAt).toBe(0);
    });

    it('persists and retrieves updated profile with valid constraints', () => {
      const updated = service.setProfile({
        seriesId: 'series-webtoon-1',
        chunkHeightPx: 512,
        bitstreamQuality: 75,
        progressivePassCount: 1,
        idleSliceBudgetMs: 5.0,
        isEnabled: true,
        updatedAt: Date.now(),
      });

      expect(updated.seriesId).toBe('series-webtoon-1');
      expect(updated.chunkHeightPx).toBe(512);
      expect(updated.bitstreamQuality).toBe(75);
      expect(updated.idleSliceBudgetMs).toBe(5.0);

      const fetched = service.getProfile('series-webtoon-1');
      expect(fetched.chunkHeightPx).toBe(512);
      expect(fetched.bitstreamQuality).toBe(75);
      expect(fetched.progressivePassCount).toBe(1);
    });
  });
});
