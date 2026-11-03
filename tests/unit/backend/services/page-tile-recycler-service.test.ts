/**
 * KuraScroll Sprint 101: Page Tile Recycler Service Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import {
  PageTileRecyclerService,
  PAGE_BUFFER_PRESETS,
  calculatePageTileRecyclingMatrix,
  PageTileSlot,
} from '../../../../src/backend/services/page-tile-recycler-service.js';

describe('PageTileRecyclerService', () => {
  let db: DatabaseInstance;
  let service: PageTileRecyclerService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS page_buffer_profiles (
        series_id TEXT PRIMARY KEY,
        ring_capacity INTEGER NOT NULL DEFAULT 7 CHECK (ring_capacity >= 3 AND ring_capacity <= 15),
        forward_lookahead INTEGER NOT NULL DEFAULT 3 CHECK (forward_lookahead >= 1 AND forward_lookahead <= 10),
        backward_lookahead INTEGER NOT NULL DEFAULT 2 CHECK (backward_lookahead >= 0 AND backward_lookahead <= 5),
        slot_recycling_strategy TEXT NOT NULL DEFAULT 'circular_lru' CHECK (slot_recycling_strategy IN (
            'circular_lru',
            'boustrophedon_ring',
            'pinned_viewport'
        )),
        zero_copy_slice_enabled INTEGER NOT NULL DEFAULT 1 CHECK (zero_copy_slice_enabled IN (0, 1)),
        max_memory_pool_bytes INTEGER NOT NULL DEFAULT 33554432 CHECK (max_memory_pool_bytes >= 8388608 AND max_memory_pool_bytes <= 67108864),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_page_buffer_lookup ON page_buffer_profiles(series_id);
    `);
    service = new PageTileRecyclerService(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('getProfile & upsertProfile', () => {
    it('returns default fallback profile when series is not stored in DB', () => {
      const profile = service.getProfile('series-nonexistent');
      expect(profile.seriesId).toBe('series-nonexistent');
      expect(profile.ringCapacity).toBe(7);
      expect(profile.forwardLookahead).toBe(3);
      expect(profile.backwardLookahead).toBe(2);
      expect(profile.slotRecyclingStrategy).toBe('circular_lru');
      expect(profile.zeroCopySliceEnabled).toBe(true);
      expect(profile.maxMemoryPoolBytes).toBe(33554432);
    });

    it('upserts and retrieves custom profile', () => {
      const saved = service.upsertProfile({
        seriesId: 'series-custom-1',
        ringCapacity: 9,
        forwardLookahead: 4,
        backwardLookahead: 3,
        slotRecyclingStrategy: 'boustrophedon_ring',
        zeroCopySliceEnabled: false,
        maxMemoryPoolBytes: 41943040,
      });

      expect(saved.seriesId).toBe('series-custom-1');
      expect(saved.ringCapacity).toBe(9);
      expect(saved.forwardLookahead).toBe(4);
      expect(saved.backwardLookahead).toBe(3);
      expect(saved.slotRecyclingStrategy).toBe('boustrophedon_ring');
      expect(saved.zeroCopySliceEnabled).toBe(false);

      const retrieved = service.getProfile('series-custom-1');
      expect(retrieved.ringCapacity).toBe(9);
      expect(retrieved.slotRecyclingStrategy).toBe('boustrophedon_ring');
    });

    it('clamps numerical bounds to safe hardware limits', () => {
      const saved = service.upsertProfile({
        seriesId: 'series-clamped',
        ringCapacity: 999, // Should clamp to 15
        forwardLookahead: 99, // Should clamp to 10
        backwardLookahead: -5, // Should clamp to 0
        maxMemoryPoolBytes: 1000000000, // Should clamp to 67108864
      });

      expect(saved.ringCapacity).toBe(15);
      expect(saved.forwardLookahead).toBe(10);
      expect(saved.backwardLookahead).toBe(0);
      expect(saved.maxMemoryPoolBytes).toBe(67108864);
    });

    it('returns all system presets', () => {
      const presets = service.getPresets();
      expect(presets.standard_lru).toBeDefined();
      expect(presets.low_ram).toBeDefined();
      expect(presets.boustrophedon).toBeDefined();
      expect(presets.pinned_viewport).toBeDefined();
      expect(presets.low_ram.ringCapacity).toBe(5);
    });
  });

  describe('calculatePageTileRecyclingMatrix', () => {
    it('calculates initial ring allocation with empty slot state', () => {
      const result = calculatePageTileRecyclingMatrix(0, 20, 7, 3, 2, 'circular_lru');
      expect(result.recycledSlotIndex).toBe(0);
      expect(result.slots.length).toBe(7);
      expect(result.slots[0].state).toBe('active');
      expect(result.slots[0].pageIndex).toBe(0);
      expect(result.hitRatio).toBe(1.0);
      expect(result.latencyUs).toBeLessThan(1500);
    });

    it('identifies evictable slot furthest away from current window', () => {
      const mockSlots: PageTileSlot[] = [
        { slotIndex: 0, pageIndex: 1, isPinned: false, state: 'prefetched', byteLength: 1048576 },
        { slotIndex: 1, pageIndex: 2, isPinned: false, state: 'prefetched', byteLength: 1048576 },
        { slotIndex: 2, pageIndex: 3, isPinned: false, state: 'prefetched', byteLength: 1048576 },
        { slotIndex: 3, pageIndex: 4, isPinned: false, state: 'prefetched', byteLength: 1048576 },
        { slotIndex: 4, pageIndex: 5, isPinned: false, state: 'prefetched', byteLength: 1048576 },
        { slotIndex: 5, pageIndex: 6, isPinned: false, state: 'prefetched', byteLength: 1048576 },
        { slotIndex: 6, pageIndex: 7, isPinned: false, state: 'prefetched', byteLength: 1048576 },
      ];

      // Jump to page 12 (window: 10..15)
      const result = calculatePageTileRecyclingMatrix(
        12,
        30,
        7,
        3,
        2,
        'circular_lru',
        mockSlots,
        'forward'
      );

      // Page 1 is furthest away from page 12 (distance 11), so slot 0 should be evicted/recycled
      expect(result.evictedPageIndex).toBe(1);
      expect(result.recycledSlotIndex).toBe(0);
    });

    it('protects pinned viewport slot from eviction under pinned_viewport strategy', () => {
      const mockSlots: PageTileSlot[] = [
        { slotIndex: 0, pageIndex: 1, isPinned: true, state: 'active', byteLength: 1048576 },
        { slotIndex: 1, pageIndex: 2, isPinned: false, state: 'prefetched', byteLength: 1048576 },
        { slotIndex: 2, pageIndex: 3, isPinned: false, state: 'prefetched', byteLength: 1048576 },
      ];

      const result = calculatePageTileRecyclingMatrix(
        10,
        30,
        3,
        1,
        1,
        'pinned_viewport',
        mockSlots,
        'forward'
      );

      // Slot 0 is pinned, so slot 1 (page 2) should be selected for eviction instead of slot 0
      expect(result.recycledSlotIndex).not.toBe(0);
    });

    it('generates zero-copy subarray split offsets when zeroCopySliceEnabled is true', () => {
      const pageSize = 2000000;
      const result = calculatePageTileRecyclingMatrix(
        5,
        20,
        7,
        3,
        2,
        'circular_lru',
        undefined,
        'forward',
        true,
        pageSize
      );

      expect(result.zeroCopySubarrays.length).toBe(2);
      expect(result.zeroCopySubarrays[0].byteOffset).toBe(0);
      expect(result.zeroCopySubarrays[0].byteLength).toBe(1000000);
      expect(result.zeroCopySubarrays[1].byteOffset).toBe(1000000);
      expect(result.zeroCopySubarrays[1].byteLength).toBe(1000000);
    });

    it('omits zero-copy subarrays when zeroCopySliceEnabled is false', () => {
      const result = calculatePageTileRecyclingMatrix(
        5,
        20,
        7,
        3,
        2,
        'circular_lru',
        undefined,
        'forward',
        false
      );

      expect(result.zeroCopySubarrays.length).toBe(0);
    });

    it('executes in strictly under 20 microseconds for SLA 65 compliance', () => {
      // Warm up
      for (let i = 0; i < 50; i++) {
        calculatePageTileRecyclingMatrix(i % 10, 20, 7, 3, 2, 'circular_lru');
      }

      const runs = 1000;
      const start = process.hrtime.bigint();
      for (let i = 0; i < runs; i++) {
        calculatePageTileRecyclingMatrix(i % 20, 50, 7, 3, 2, 'circular_lru');
      }
      const end = process.hrtime.bigint();
      const avgUs = Number(end - start) / (runs * 1000);

      expect(avgUs).toBeLessThan(20);
    });
  });
});
