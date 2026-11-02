import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  TileInvalidationService,
  calculateTileInvalidation,
  DEFAULT_TILE_INVALIDATION_PROFILE,
  TileCandidate,
  ViewportKinematics,
} from '../../../../src/backend/services/tile-invalidation-service.js';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';

describe('Sprint 107 - TileInvalidationService', () => {
  let db: DatabaseInstance;
  let service: TileInvalidationService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS tile_invalidation_profiles (
        series_id TEXT PRIMARY KEY,
        max_heap_mb REAL NOT NULL DEFAULT 128.0 CHECK (max_heap_mb >= 32.0 AND max_heap_mb <= 256.0),
        viewport_margin_px REAL NOT NULL DEFAULT 600.0 CHECK (viewport_margin_px >= 100.0 AND viewport_margin_px <= 2000.0),
        warm_margin_px REAL NOT NULL DEFAULT 1500.0 CHECK (warm_margin_px >= 500.0 AND warm_margin_px <= 5000.0),
        eviction_budget_ms REAL NOT NULL DEFAULT 1.5 CHECK (eviction_budget_ms >= 0.5 AND eviction_budget_ms <= 8.0),
        velocity_weight REAL NOT NULL DEFAULT 0.65 CHECK (velocity_weight >= 0.00 AND velocity_weight <= 1.00),
        recency_weight REAL NOT NULL DEFAULT 0.25 CHECK (recency_weight >= 0.00 AND recency_weight <= 1.00),
        size_weight REAL NOT NULL DEFAULT 0.10 CHECK (size_weight >= 0.00 AND size_weight <= 1.00),
        is_auto_gc_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_auto_gc_enabled IN (0, 1)),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_tile_invalidation_lookup ON tile_invalidation_profiles(series_id);
    `);
    service = new TileInvalidationService(db);
  });

  afterEach(() => {
    try {
      db.close();
    } catch {
      // ignore
    }
  });

  it('should return default profile if none exists', () => {
    const profile = service.getProfile('test-series-1');
    expect(profile.seriesId).toBe('test-series-1');
    expect(profile.maxHeapMb).toBe(DEFAULT_TILE_INVALIDATION_PROFILE.maxHeapMb);
    expect(profile.viewportMarginPx).toBe(DEFAULT_TILE_INVALIDATION_PROFILE.viewportMarginPx);
    expect(profile.warmMarginPx).toBe(DEFAULT_TILE_INVALIDATION_PROFILE.warmMarginPx);
    expect(profile.isAutoGcEnabled).toBe(true);
  });

  it('should upsert and retrieve updated profile', () => {
    const updated = service.upsertProfile('test-series-2', {
      maxHeapMb: 64.0,
      viewportMarginPx: 400.0,
      warmMarginPx: 1200.0,
      evictionBudgetMs: 1.0,
      isAutoGcEnabled: false,
    });

    expect(updated.seriesId).toBe('test-series-2');
    expect(updated.maxHeapMb).toBe(64.0);
    expect(updated.viewportMarginPx).toBe(400.0);
    expect(updated.warmMarginPx).toBe(1200.0);
    expect(updated.evictionBudgetMs).toBe(1.0);
    expect(updated.isAutoGcEnabled).toBe(false);

    const retrieved = service.getProfile('test-series-2');
    expect(retrieved.maxHeapMb).toBe(64.0);
    expect(retrieved.isAutoGcEnabled).toBe(false);
  });

  it('should classify tiles inside viewport as ACTIVE_VIEWPORT', () => {
    const tiles: TileCandidate[] = [
      {
        id: 'tile-center',
        x: 400,
        y: 300,
        width: 256,
        height: 256,
        sizeBytes: 150000,
        lastAccessedEpochMs: 100000,
      },
    ];

    const kinematics: ViewportKinematics = {
      viewportX: 0,
      viewportY: 0,
      viewportWidth: 1280,
      viewportHeight: 720,
      velocityX: 0,
      velocityY: 100,
      nowEpochMs: 101000,
      currentHeapMb: 50,
    };

    const result = calculateTileInvalidation(tiles, kinematics);
    expect(result.tiles.length).toBe(1);
    expect(result.tiles[0].retentionClass).toBe('ACTIVE_VIEWPORT');
    expect(result.tiles[0].evictionScore).toBe(0.0);
    expect(result.activeCount).toBe(1);
    expect(result.warmCount).toBe(0);
  });

  it('should classify lookahead tiles as PRESERVE_WARM', () => {
    const tiles: TileCandidate[] = [
      {
        id: 'tile-lookahead',
        x: 400,
        y: 2000,
        width: 256,
        height: 256,
        sizeBytes: 150000,
        lastAccessedEpochMs: 95000,
      },
    ];

    const kinematics: ViewportKinematics = {
      viewportX: 0,
      viewportY: 0,
      viewportWidth: 1280,
      viewportHeight: 720,
      velocityX: 0,
      velocityY: 500, // scrolling down towards y=2000
      nowEpochMs: 100000,
      currentHeapMb: 50,
    };

    const result = calculateTileInvalidation(tiles, kinematics);
    expect(result.tiles[0].retentionClass).toBe('PRESERVE_WARM');
    expect(result.warmCount).toBe(1);
    expect(result.tiles[0].evictionScore).toBeLessThan(0.3);
  });

  it('should mark distant and old tiles as EVICT_IMMEDIATE and reclaim bytes', () => {
    const tiles: TileCandidate[] = [
      {
        id: 'tile-ancient',
        x: 0,
        y: 8000,
        width: 500,
        height: 500,
        sizeBytes: 400000,
        lastAccessedEpochMs: 50000,
      },
    ];

    const kinematics: ViewportKinematics = {
      viewportX: 0,
      viewportY: 0,
      viewportWidth: 1280,
      viewportHeight: 720,
      velocityX: 0,
      velocityY: 0,
      nowEpochMs: 100000, // age = 50,000ms > 10,000ms
      currentHeapMb: 50,
    };

    const result = calculateTileInvalidation(tiles, kinematics);
    expect(result.tiles[0].retentionClass).toBe('EVICT_IMMEDIATE');
    expect(result.immediateCount).toBe(1);
    expect(result.reclaimedBytes).toBe(400000);
    expect(result.tiles[0].evictionScore).toBeGreaterThanOrEqual(0.85);
  });

  it('should trigger emergency eviction when current heap exceeds maxHeapMb', () => {
    const tiles: TileCandidate[] = [
      {
        id: 'tile-outside-vp',
        x: 0,
        y: 1500,
        width: 300,
        height: 300,
        sizeBytes: 250000,
        lastAccessedEpochMs: 99000,
      },
    ];

    const kinematics: ViewportKinematics = {
      viewportX: 0,
      viewportY: 0,
      viewportWidth: 1280,
      viewportHeight: 720,
      velocityX: 0,
      velocityY: 0,
      nowEpochMs: 100000,
      currentHeapMb: 150, // exceeds default 128MB maxHeapMb
    };

    const result = calculateTileInvalidation(tiles, kinematics);
    expect(result.tiles[0].retentionClass).toBe('EVICT_IMMEDIATE');
    expect(result.immediateCount).toBe(1);
  });

  it('should return valid presets', () => {
    const presets = service.getPresets();
    expect(presets.balanced).toBeDefined();
    expect(presets.ultra_low_ram).toBeDefined();
    expect(presets.aggressive_prefetch).toBeDefined();
    expect(presets.ultra_low_ram.maxHeapMb).toBe(64.0);
  });

  it('should evaluate tile batch in < 50 µs per call after warmup', () => {
    const tiles: TileCandidate[] = Array.from({ length: 20 }, (_, idx) => ({
      id: `tile-${idx}`,
      x: (idx % 4) * 300,
      y: Math.floor(idx / 4) * 300,
      width: 256,
      height: 256,
      sizeBytes: 150000,
      lastAccessedEpochMs: 100000 - idx * 500,
    }));

    const kinematics: ViewportKinematics = {
      viewportX: 0,
      viewportY: 0,
      viewportWidth: 1280,
      viewportHeight: 720,
      velocityX: 0,
      velocityY: 200,
      nowEpochMs: 105000,
      currentHeapMb: 70,
    };

    // Warmup
    for (let i = 0; i < 500; i++) {
      calculateTileInvalidation(tiles, kinematics);
    }

    const t0 = process.hrtime.bigint();
    const result = calculateTileInvalidation(tiles, kinematics);
    const t1 = process.hrtime.bigint();
    const durationUs = Number(t1 - t0) / 1000;

    expect(result.tiles.length).toBe(20);
    expect(durationUs).toBeLessThan(50);
  });
});
