import { describe, it, expect, beforeEach } from 'vitest';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import {
  TilePrefetchService,
  calculateTilePrefetchDecision,
  resetPrefetchRingBuffer,
  getPrefetchRingBufferState,
  TILE_PREFETCH_PRESETS,
  RING_CAPACITY,
} from '../../../../src/backend/services/tile-prefetch-service.js';

describe('TilePrefetchService', () => {
  let db: DatabaseInstance;
  let service: TilePrefetchService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    service = new TilePrefetchService(db);
    resetPrefetchRingBuffer();
  });

  it('returns default unpersisted profile with deterministic timestamps', () => {
    const profile = service.getProfile('series-tp-1');
    expect(profile.seriesId).toBe('series-tp-1');
    expect(profile.readingFlow).toBe('manga_rtl');
    expect(profile.predictionHorizonMs).toBe(350);
    expect(profile.recencyTauMs).toBe(8000);
    expect(profile.maxPrefetchTiles).toBe(3);
    expect(profile.hysteresisThreshold).toBe(0.65);
    expect(profile.isEnabled).toBe(true);
    expect(profile.createdAt).toBe(0);
    expect(profile.updatedAt).toBe(0);
  });

  it('upserts and clamps profile parameters within safe bounds', () => {
    const updated = service.upsertProfile({
      seriesId: 'series-clamped-tp',
      readingFlow: 'webtoon_vertical',
      predictionHorizonMs: 5000, // clamp to 1000
      recencyTauMs: 500, // clamp to 1000
      maxPrefetchTiles: 20, // clamp to 8
      hysteresisThreshold: 0.99, // clamp to 0.90
    });

    expect(updated.predictionHorizonMs).toBe(1000);
    expect(updated.recencyTauMs).toBe(1000);
    expect(updated.maxPrefetchTiles).toBe(8);
    expect(updated.hysteresisThreshold).toBe(0.90);
    expect(updated.readingFlow).toBe('webtoon_vertical');

    const fetched = service.getProfile('series-clamped-tp');
    expect(fetched.predictionHorizonMs).toBe(1000);
    expect(fetched.maxPrefetchTiles).toBe(8);
  });

  it('calculates zero-allocation Markov prefetch decisions accurately', () => {
    // Under threshold -> should not prefetch
    const lowProb = calculateTilePrefetchDecision(10, 11, 0.45, 0.65);
    expect(lowProb.shouldPrefetch).toBe(false);
    expect(lowProb.selectedTileId).toBe(11);

    // Over threshold -> should prefetch into ring buffer
    const highProb = calculateTilePrefetchDecision(10, 11, 0.78, 0.65);
    expect(highProb.shouldPrefetch).toBe(true);
    expect(highProb.selectedTileId).toBe(11);
    expect(highProb.evictedTileId).toBe(-1);
    expect(highProb.slotIndex).toBeGreaterThanOrEqual(0);

    // Same candidate -> cache hit, should not fetch again
    const hit = calculateTilePrefetchDecision(10, 11, 0.85, 0.65);
    expect(hit.shouldPrefetch).toBe(false);
    expect(hit.slotIndex).toBe(highProb.slotIndex);
  });

  it('evicts least recently used slot when ring buffer reaches capacity (64)', () => {
    // Fill all 64 slots
    for (let i = 0; i < RING_CAPACITY; i++) {
      calculateTilePrefetchDecision(0, i, 0.80, 0.65);
    }

    const state = getPrefetchRingBufferState();
    expect(state.cachedCount).toBe(RING_CAPACITY);

    // 65th tile must trigger LRU eviction of oldest unpinned slot (slot 0)
    const evictDecision = calculateTilePrefetchDecision(0, 999, 0.90, 0.65);
    expect(evictDecision.shouldPrefetch).toBe(true);
    expect(evictDecision.evictedTileId).toBe(0);
    expect(evictDecision.selectedTileId).toBe(999);
  });

  it('contains valid presets across all flow modes', () => {
    const flows = Object.keys(TILE_PREFETCH_PRESETS);
    expect(flows).toContain('manga_rtl');
    expect(flows).toContain('comic_ltr');
    expect(flows).toContain('webtoon_vertical');
    expect(flows).toContain('cinematic_dynamic');

    for (const flow of flows) {
      const preset = TILE_PREFETCH_PRESETS[flow as keyof typeof TILE_PREFETCH_PRESETS];
      expect(preset.predictionHorizonMs).toBeGreaterThanOrEqual(100);
      expect(preset.hysteresisThreshold).toBeGreaterThanOrEqual(0.5);
    }
  });

  it('generates consistent ETags for cache validation', () => {
    const p1 = service.getProfile('series-etag-1');
    const tag1 = service.generateETag(p1);
    const tag2 = service.generateETag(p1);
    expect(tag1).toBe(tag2);

    const updated = service.upsertProfile({
      seriesId: 'series-etag-1',
      readingFlow: 'cinematic_dynamic',
    });
    const tag3 = service.generateETag(updated);
    expect(tag1).not.toBe(tag3);
  });
});
