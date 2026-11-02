/**
 * KuraScroll - Sprint 86: Continuous Page In-Viewport Micro-Cache & Sliding Window Prefetch Engine
 * 
 * Hardware-tuned for Intel Pentium T4500 (heap <= 512MB) & Intel GMA 4500MHD (texture <= 2048x2048).
 * Ensures zero DOM ballooning, bounded VRAM texture allocations, and sequential HDD I/O streams.
 */

import { DatabaseInstance } from '../db/database.js';

export type SlidingWindowMode = 'conservative' | 'aggressive' | 'preload_heavy';

export interface SlidingWindowProfile {
  seriesId: string;
  windowSize: number;
  forwardBuffer: number;
  backwardBuffer: number;
  evictStrategy: SlidingWindowMode;
  maxCachedBytes: number;
  isEnabled: boolean;
  updatedAt: number;
}

export interface SlidingWindowCalculationResult {
  totalCount: number;
  currentIndex: number;
  startIndex: number;
  endIndex: number;
  activeCount: number;
  activeIndices: number[];
  prefetchIndices: number[];
  evictedCount: number;
  estimatedMemoryBytes: number;
  isWithinBounds: boolean;
}

export const SLIDING_WINDOW_MODES = {
  conservative: {
    name: 'conservative' as SlidingWindowMode,
    label: 'Conservative (HDD Optimized)',
    windowSize: 5,
    forwardBuffer: 3,
    backwardBuffer: 2,
    maxCachedBytes: 26214400, // 25 MB
    description: 'Conservative memory footprint, sequential HDD read-ahead, ideal for 5400RPM'
  },
  aggressive: {
    name: 'aggressive' as SlidingWindowMode,
    label: 'Aggressive (Low VRAM)',
    windowSize: 3,
    forwardBuffer: 2,
    backwardBuffer: 1,
    maxCachedBytes: 15728640, // 15 MB
    description: 'Ultra-low DOM & texture footprint for Intel GMA 4500MHD'
  },
  preload_heavy: {
    name: 'preload_heavy' as SlidingWindowMode,
    label: 'Preload Heavy (SSD / High-RAM)',
    windowSize: 8,
    forwardBuffer: 5,
    backwardBuffer: 3,
    maxCachedBytes: 41943040, // 40 MB
    description: 'Maximum forward prefetch buffer for seamless high-speed flick scrolling'
  }
} as const;

export class SlidingWindowService {
  private db: DatabaseInstance;

  constructor(db: DatabaseInstance) {
    this.db = db;
  }

  /**
   * Ultra-fast zero/minimal-allocation sliding window calculation.
   * Bound to sub-20 microseconds SLA for up to 200 pages.
   */
  public calculateSlidingWindow(
    totalCount: number,
    currentIndex: number,
    forwardBuffer: number = 3,
    backwardBuffer: number = 2,
    bytesPerPage: number = 2621440 // ~2.5MB per decoded RGBA texture
  ): SlidingWindowCalculationResult {
    if (totalCount <= 0) {
      return {
        totalCount: 0,
        currentIndex: 0,
        startIndex: 0,
        endIndex: 0,
        activeCount: 0,
        activeIndices: [],
        prefetchIndices: [],
        evictedCount: 0,
        estimatedMemoryBytes: 0,
        isWithinBounds: false
      };
    }

    const clampedCurrent = Math.max(0, Math.min(totalCount - 1, Math.floor(currentIndex)));
    const clampedFwd = Math.max(0, Math.min(10, Math.floor(forwardBuffer)));
    const clampedBack = Math.max(0, Math.min(10, Math.floor(backwardBuffer)));

    const startIndex = Math.max(0, clampedCurrent - clampedBack);
    const endIndex = Math.min(totalCount - 1, clampedCurrent + clampedFwd);
    const activeCount = endIndex - startIndex + 1;

    const activeIndices: number[] = new Array(activeCount);
    for (let i = 0; i < activeCount; i++) {
      activeIndices[i] = startIndex + i;
    }

    const prefetchCount = Math.max(0, endIndex - clampedCurrent);
    const prefetchIndices: number[] = new Array(prefetchCount);
    for (let p = 0; p < prefetchCount; p++) {
      prefetchIndices[p] = clampedCurrent + 1 + p;
    }

    const evictedCount = totalCount - activeCount;
    const estimatedMemoryBytes = activeCount * bytesPerPage;

    return {
      totalCount,
      currentIndex: clampedCurrent,
      startIndex,
      endIndex,
      activeCount,
      activeIndices,
      prefetchIndices,
      evictedCount,
      estimatedMemoryBytes,
      isWithinBounds: currentIndex >= 0 && currentIndex < totalCount
    };
  }

  /**
   * Retrieves profile for a series or returns system default.
   */
  public getProfile(seriesId: string): SlidingWindowProfile {
    const row = this.db.prepare(`
      SELECT series_id, window_size, forward_buffer, backward_buffer, evict_strategy, max_cached_bytes, is_enabled, updated_at
      FROM sliding_window_profiles
      WHERE series_id = ?
    `).get(seriesId) as {
      series_id: string;
      window_size: number;
      forward_buffer: number;
      backward_buffer: number;
      evict_strategy: string;
      max_cached_bytes: number;
      is_enabled: number;
      updated_at: number;
    } | undefined;

    if (!row) {
      return {
        seriesId,
        windowSize: SLIDING_WINDOW_MODES.conservative.windowSize,
        forwardBuffer: SLIDING_WINDOW_MODES.conservative.forwardBuffer,
        backwardBuffer: SLIDING_WINDOW_MODES.conservative.backwardBuffer,
        evictStrategy: 'conservative',
        maxCachedBytes: SLIDING_WINDOW_MODES.conservative.maxCachedBytes,
        isEnabled: true,
        updatedAt: 0
      };
    }

    return {
      seriesId: row.series_id,
      windowSize: row.window_size,
      forwardBuffer: row.forward_buffer,
      backwardBuffer: row.backward_buffer,
      evictStrategy: row.evict_strategy as SlidingWindowMode,
      maxCachedBytes: row.max_cached_bytes,
      isEnabled: row.is_enabled === 1,
      updatedAt: row.updated_at
    };
  }

  /**
   * Upserts a sliding window profile with validation.
   */
  public setProfile(profile: SlidingWindowProfile): SlidingWindowProfile {
    const windowSize = Math.max(1, Math.min(20, Math.floor(profile.windowSize)));
    const forwardBuffer = Math.max(1, Math.min(10, Math.floor(profile.forwardBuffer)));
    const backwardBuffer = Math.max(1, Math.min(10, Math.floor(profile.backwardBuffer)));
    const maxCachedBytes = Math.max(5242880, Math.min(104857600, Math.floor(profile.maxCachedBytes)));
    const isEnabled = profile.isEnabled ? 1 : 0;
    const updatedAt = Date.now();
    const evictStrategy = ['conservative', 'aggressive', 'preload_heavy'].includes(profile.evictStrategy)
      ? profile.evictStrategy
      : 'conservative';

    this.db.prepare(`
      INSERT INTO sliding_window_profiles (
        series_id, window_size, forward_buffer, backward_buffer, evict_strategy, max_cached_bytes, is_enabled, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(series_id) DO UPDATE SET
        window_size = excluded.window_size,
        forward_buffer = excluded.forward_buffer,
        backward_buffer = excluded.backward_buffer,
        evict_strategy = excluded.evict_strategy,
        max_cached_bytes = excluded.max_cached_bytes,
        is_enabled = excluded.is_enabled,
        updated_at = excluded.updated_at
    `).run(
      profile.seriesId,
      windowSize,
      forwardBuffer,
      backwardBuffer,
      evictStrategy,
      maxCachedBytes,
      isEnabled,
      updatedAt
    );

    return {
      seriesId: profile.seriesId,
      windowSize,
      forwardBuffer,
      backwardBuffer,
      evictStrategy: evictStrategy as SlidingWindowMode,
      maxCachedBytes,
      isEnabled: isEnabled === 1,
      updatedAt
    };
  }
}
