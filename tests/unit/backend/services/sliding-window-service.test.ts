/**
 * KuraScroll Sprint 86: Continuous Page In-Viewport Micro-Cache & Sliding Window Service Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import {
  SlidingWindowService,
  SLIDING_WINDOW_MODES,
  SlidingWindowProfile,
} from '../../../../src/backend/services/sliding-window-service.js';

describe('SlidingWindowService', () => {
  let db: DatabaseInstance;
  let service: SlidingWindowService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS sliding_window_profiles (
        series_id TEXT PRIMARY KEY,
        window_size INTEGER NOT NULL DEFAULT 5 CHECK (window_size >= 1 AND window_size <= 20),
        forward_buffer INTEGER NOT NULL DEFAULT 3 CHECK (forward_buffer >= 1 AND forward_buffer <= 10),
        backward_buffer INTEGER NOT NULL DEFAULT 2 CHECK (backward_buffer >= 1 AND backward_buffer <= 10),
        evict_strategy TEXT NOT NULL DEFAULT 'conservative' CHECK (evict_strategy IN ('conservative', 'aggressive', 'preload_heavy')),
        max_cached_bytes INTEGER NOT NULL DEFAULT 26214400 CHECK (max_cached_bytes >= 5242880 AND max_cached_bytes <= 104857600),
        is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sliding_window_lookup ON sliding_window_profiles(series_id);
    `);
    service = new SlidingWindowService(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('calculateSlidingWindow', () => {
    it('returns empty window for empty chapter (0 pages)', () => {
      const res = service.calculateSlidingWindow(0, 0);
      expect(res.totalCount).toBe(0);
      expect(res.activeCount).toBe(0);
      expect(res.activeIndices).toEqual([]);
      expect(res.isWithinBounds).toBe(false);
    });

    it('calculates symmetrical sliding window in middle of chapter', () => {
      // 50 pages, currentIndex = 10, forwardBuffer = 3, backwardBuffer = 2
      const res = service.calculateSlidingWindow(50, 10, 3, 2);
      expect(res.startIndex).toBe(8);
      expect(res.endIndex).toBe(13);
      expect(res.activeCount).toBe(6);
      expect(res.activeIndices).toEqual([8, 9, 10, 11, 12, 13]);
      expect(res.prefetchIndices).toEqual([11, 12, 13]);
      expect(res.evictedCount).toBe(44);
      expect(res.isWithinBounds).toBe(true);
    });

    it('clamps correctly at start of chapter (page 0)', () => {
      const res = service.calculateSlidingWindow(50, 0, 3, 2);
      expect(res.startIndex).toBe(0);
      expect(res.endIndex).toBe(3);
      expect(res.activeCount).toBe(4);
      expect(res.activeIndices).toEqual([0, 1, 2, 3]);
      expect(res.prefetchIndices).toEqual([1, 2, 3]);
      expect(res.evictedCount).toBe(46);
    });

    it('clamps correctly at end of chapter (last page)', () => {
      const res = service.calculateSlidingWindow(50, 49, 3, 2);
      expect(res.startIndex).toBe(47);
      expect(res.endIndex).toBe(49);
      expect(res.activeCount).toBe(3);
      expect(res.activeIndices).toEqual([47, 48, 49]);
      expect(res.prefetchIndices).toEqual([]);
      expect(res.evictedCount).toBe(47);
    });

    it('handles single page chapters safely', () => {
      const res = service.calculateSlidingWindow(1, 0, 3, 2);
      expect(res.startIndex).toBe(0);
      expect(res.endIndex).toBe(0);
      expect(res.activeCount).toBe(1);
      expect(res.activeIndices).toEqual([0]);
      expect(res.prefetchIndices).toEqual([]);
      expect(res.evictedCount).toBe(0);
    });

    it('correctly clamps out-of-bounds indices and flags isWithinBounds', () => {
      const resUnderflow = service.calculateSlidingWindow(20, -5, 3, 2);
      expect(resUnderflow.currentIndex).toBe(0);
      expect(resUnderflow.isWithinBounds).toBe(false);

      const resOverflow = service.calculateSlidingWindow(20, 100, 3, 2);
      expect(resOverflow.currentIndex).toBe(19);
      expect(resOverflow.isWithinBounds).toBe(false);
    });

    it('accurately calculates estimated memory bytes for GMA 4500MHD texture tracking', () => {
      const res = service.calculateSlidingWindow(30, 5, 2, 1, 2097152); // 2MB per page
      // active: 4, 5, 6, 7 => 4 pages
      expect(res.activeCount).toBe(4);
      expect(res.estimatedMemoryBytes).toBe(4 * 2097152);
    });
  });

  describe('getProfile and setProfile', () => {
    it('returns default conservative profile when not found in DB', () => {
      const prof = service.getProfile('series-xyz');
      expect(prof.seriesId).toBe('series-xyz');
      expect(prof.evictStrategy).toBe('conservative');
      expect(prof.windowSize).toBe(SLIDING_WINDOW_MODES.conservative.windowSize);
      expect(prof.forwardBuffer).toBe(SLIDING_WINDOW_MODES.conservative.forwardBuffer);
      expect(prof.backwardBuffer).toBe(SLIDING_WINDOW_MODES.conservative.backwardBuffer);
      expect(prof.isEnabled).toBe(true);
    });

    it('persists and updates sliding window profile with valid ranges', () => {
      const updated = service.setProfile({
        seriesId: 'series-test-1',
        windowSize: 8,
        forwardBuffer: 5,
        backwardBuffer: 3,
        evictStrategy: 'preload_heavy',
        maxCachedBytes: 41943040,
        isEnabled: true,
        updatedAt: Date.now(),
      });

      expect(updated.seriesId).toBe('series-test-1');
      expect(updated.evictStrategy).toBe('preload_heavy');
      expect(updated.forwardBuffer).toBe(5);
      expect(updated.backwardBuffer).toBe(3);

      const fetched = service.getProfile('series-test-1');
      expect(fetched.seriesId).toBe('series-test-1');
      expect(fetched.evictStrategy).toBe('preload_heavy');
      expect(fetched.maxCachedBytes).toBe(41943040);
    });
  });
});
