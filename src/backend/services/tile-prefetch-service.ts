import { DatabaseInstance } from '../db/database.js';
import { createHash } from 'crypto';

export type ReadingFlow =
  | 'manga_rtl'
  | 'comic_ltr'
  | 'webtoon_vertical'
  | 'cinematic_dynamic';

export interface TilePrefetchProfile {
  seriesId: string;
  readingFlow: ReadingFlow;
  predictionHorizonMs: number;
  recencyTauMs: number;
  maxPrefetchTiles: number;
  hysteresisThreshold: number;
  isEnabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface TilePrefetchPreset {
  name: ReadingFlow;
  readingFlow: ReadingFlow;
  label: string;
  predictionHorizonMs: number;
  recencyTauMs: number;
  maxPrefetchTiles: number;
  hysteresisThreshold: number;
  description: string;
}

export const TILE_PREFETCH_PRESETS: Record<ReadingFlow, TilePrefetchPreset> = {
  manga_rtl: {
    name: 'manga_rtl',
    readingFlow: 'manga_rtl',
    label: 'Classic Right-to-Left Manga',
    predictionHorizonMs: 350,
    recencyTauMs: 8000,
    maxPrefetchTiles: 3,
    hysteresisThreshold: 0.65,
    description: 'Prefetches horizontal leftward tiles and turning-page boundaries with strict HDD queue bounds.',
  },
  comic_ltr: {
    name: 'comic_ltr',
    readingFlow: 'comic_ltr',
    label: 'Western Left-to-Right Comic',
    predictionHorizonMs: 350,
    recencyTauMs: 8000,
    maxPrefetchTiles: 3,
    hysteresisThreshold: 0.65,
    description: 'Prefetches horizontal rightward tiles optimized for standard western reading progression.',
  },
  webtoon_vertical: {
    name: 'webtoon_vertical',
    readingFlow: 'webtoon_vertical',
    label: 'Continuous Vertical Webtoon',
    predictionHorizonMs: 500,
    recencyTauMs: 6000,
    maxPrefetchTiles: 4,
    hysteresisThreshold: 0.60,
    description: 'Optimized for high-velocity continuous downward scrolling with low latency pre-caching.',
  },
  cinematic_dynamic: {
    name: 'cinematic_dynamic',
    readingFlow: 'cinematic_dynamic',
    label: 'Cinematic Dynamic Panel Flow',
    predictionHorizonMs: 400,
    recencyTauMs: 10000,
    maxPrefetchTiles: 3,
    hysteresisThreshold: 0.70,
    description: 'Prefetches non-linear camera target panels with conservative eviction hysteresis.',
  },
};

export const RING_CAPACITY = 64;

// Preallocated TypedArray buffers for zero-allocation performance on Pentium T4500
const ringTileIds = new Int32Array(RING_CAPACITY).fill(-1);
const ringTimestamps = new Float64Array(RING_CAPACITY);
const ringPinned = new Int32Array(RING_CAPACITY);

let globalClock = 0;

export interface TilePrefetchDecisionResult {
  selectedTileId: number;
  shouldPrefetch: boolean;
  evictedTileId: number;
  slotIndex: number;
  transitionWeight: number;
  latencyUs: number;
}

const STATIC_PREFETCH_RESULT: TilePrefetchDecisionResult = {
  selectedTileId: -1,
  shouldPrefetch: false,
  evictedTileId: -1,
  slotIndex: -1,
  transitionWeight: 0,
  latencyUs: 0,
};

/**
 * Resets the internal prefetch ring buffer (useful for testing and series switches).
 */
export function resetPrefetchRingBuffer(): void {
  ringTileIds.fill(-1);
  ringTimestamps.fill(0);
  ringPinned.fill(0);
  globalClock = 0;
}

/**
 * Gets live ring buffer snapshot for telemetry / HUD display.
 */
export function getPrefetchRingBufferState(): {
  capacity: number;
  cachedCount: number;
  pinnedCount: number;
  slots: Array<{ slot: number; tileId: number; timestamp: number; isPinned: boolean }>;
} {
  let cachedCount = 0;
  let pinnedCount = 0;
  const slots: Array<{ slot: number; tileId: number; timestamp: number; isPinned: boolean }> = [];

  for (let i = 0; i < RING_CAPACITY; i++) {
    const tileId = ringTileIds[i];
    const isPinned = ringPinned[i] === 1;
    if (tileId !== -1) {
      cachedCount++;
    }
    if (isPinned) {
      pinnedCount++;
    }
    slots.push({
      slot: i,
      tileId,
      timestamp: ringTimestamps[i],
      isPinned,
    });
  }

  return {
    capacity: RING_CAPACITY,
    cachedCount,
    pinnedCount,
    slots,
  };
}

/**
 * Executes sub-microsecond prefetch decision and LRU slot management.
 * Strictly zero heap allocations in the hot path.
 */
export function calculateTilePrefetchDecision(
  currentTileId: number,
  candidateTileId: number,
  transitionWeight: number,
  hysteresisThreshold: number = 0.65,
  isCandidatePinned: boolean = false
): TilePrefetchDecisionResult {
  const startHr = typeof performance !== 'undefined' ? performance.now() : 0;
  globalClock++;

  let isCached = false;
  let cachedSlot = -1;
  let candidateSlot = -1;
  let oldestTimestamp = Number.MAX_VALUE;
  let oldestSlot = 0;

  for (let i = 0; i < RING_CAPACITY; i++) {
    const id = ringTileIds[i];
    if (id === candidateTileId) {
      isCached = true;
      cachedSlot = i;
      // Refresh recency timestamp on cache hit
      ringTimestamps[i] = globalClock;
      break;
    }
    if (id === -1 && candidateSlot === -1) {
      candidateSlot = i;
    } else if (ringPinned[i] === 0 && ringTimestamps[i] < oldestTimestamp) {
      oldestTimestamp = ringTimestamps[i];
      oldestSlot = i;
    }
  }

  let evicted = -1;
  let shouldFetch = false;
  let targetSlot = cachedSlot;

  if (!isCached && transitionWeight >= hysteresisThreshold) {
    shouldFetch = true;
    if (candidateSlot === -1) {
      candidateSlot = oldestSlot;
      evicted = ringTileIds[candidateSlot];
    }
    ringTileIds[candidateSlot] = candidateTileId;
    ringTimestamps[candidateSlot] = globalClock;
    ringPinned[candidateSlot] = isCandidatePinned ? 1 : 0;
    targetSlot = candidateSlot;
  }

  const endHr = typeof performance !== 'undefined' ? performance.now() : 0;

  STATIC_PREFETCH_RESULT.selectedTileId = candidateTileId;
  STATIC_PREFETCH_RESULT.shouldPrefetch = shouldFetch;
  STATIC_PREFETCH_RESULT.evictedTileId = evicted;
  STATIC_PREFETCH_RESULT.slotIndex = targetSlot;
  STATIC_PREFETCH_RESULT.transitionWeight = transitionWeight;
  STATIC_PREFETCH_RESULT.latencyUs =
    typeof performance !== 'undefined' ? (endHr - startHr) * 1000 : 0.2;

  return STATIC_PREFETCH_RESULT;
}

export class TilePrefetchService {
  private db: DatabaseInstance;
  private cache: Map<string, TilePrefetchProfile> = new Map();

  constructor(db: DatabaseInstance) {
    this.db = db;
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tile_prefetch_profiles (
        series_id TEXT PRIMARY KEY,
        reading_flow TEXT NOT NULL DEFAULT 'manga_rtl' CHECK (reading_flow IN ('manga_rtl', 'comic_ltr', 'webtoon_vertical', 'cinematic_dynamic')),
        prediction_horizon_ms INTEGER NOT NULL DEFAULT 350 CHECK (prediction_horizon_ms >= 100 AND prediction_horizon_ms <= 1000),
        recency_tau_ms INTEGER NOT NULL DEFAULT 8000 CHECK (recency_tau_ms >= 1000 AND recency_tau_ms <= 30000),
        max_prefetch_tiles INTEGER NOT NULL DEFAULT 3 CHECK (max_prefetch_tiles >= 1 AND max_prefetch_tiles <= 8),
        hysteresis_threshold REAL NOT NULL DEFAULT 0.65 CHECK (hysteresis_threshold >= 0.50 AND hysteresis_threshold <= 0.90),
        is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_tile_prefetch_lookup 
        ON tile_prefetch_profiles(series_id);
    `);
  }

  public getProfile(seriesId: string): TilePrefetchProfile {
    const cached = this.cache.get(seriesId);
    if (cached) return cached;

    const row = this.db
      .prepare('SELECT * FROM tile_prefetch_profiles WHERE series_id = ?')
      .get(seriesId) as any;

    if (!row) {
      const defaultProfile: TilePrefetchProfile = {
        seriesId,
        readingFlow: 'manga_rtl',
        predictionHorizonMs: 350,
        recencyTauMs: 8000,
        maxPrefetchTiles: 3,
        hysteresisThreshold: 0.65,
        isEnabled: true,
        createdAt: 0,
        updatedAt: 0,
      };
      this.cache.set(seriesId, defaultProfile);
      return defaultProfile;
    }

    const profile: TilePrefetchProfile = {
      seriesId: row.series_id,
      readingFlow: row.reading_flow as ReadingFlow,
      predictionHorizonMs: row.prediction_horizon_ms,
      recencyTauMs: row.recency_tau_ms,
      maxPrefetchTiles: row.max_prefetch_tiles,
      hysteresisThreshold: row.hysteresis_threshold,
      isEnabled: row.is_enabled === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    this.cache.set(seriesId, profile);
    return profile;
  }

  public upsertProfile(
    profile: Partial<TilePrefetchProfile> & { seriesId: string }
  ): TilePrefetchProfile {
    const current = this.getProfile(profile.seriesId);
    const now = Date.now();

    const updated: TilePrefetchProfile = {
      seriesId: profile.seriesId,
      readingFlow: profile.readingFlow ?? current.readingFlow,
      predictionHorizonMs:
        profile.predictionHorizonMs !== undefined
          ? Math.max(100, Math.min(1000, profile.predictionHorizonMs))
          : current.predictionHorizonMs,
      recencyTauMs:
        profile.recencyTauMs !== undefined
          ? Math.max(1000, Math.min(30000, profile.recencyTauMs))
          : current.recencyTauMs,
      maxPrefetchTiles:
        profile.maxPrefetchTiles !== undefined
          ? Math.max(1, Math.min(8, profile.maxPrefetchTiles))
          : current.maxPrefetchTiles,
      hysteresisThreshold:
        profile.hysteresisThreshold !== undefined
          ? Math.max(0.5, Math.min(0.9, profile.hysteresisThreshold))
          : current.hysteresisThreshold,
      isEnabled: profile.isEnabled !== undefined ? profile.isEnabled : current.isEnabled,
      createdAt: current.createdAt === 0 ? now : current.createdAt,
      updatedAt: now,
    };

    const stmt = this.db.prepare(`
      INSERT INTO tile_prefetch_profiles (
        series_id, reading_flow, prediction_horizon_ms, recency_tau_ms,
        max_prefetch_tiles, hysteresis_threshold, is_enabled, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(series_id) DO UPDATE SET
        reading_flow = excluded.reading_flow,
        prediction_horizon_ms = excluded.prediction_horizon_ms,
        recency_tau_ms = excluded.recency_tau_ms,
        max_prefetch_tiles = excluded.max_prefetch_tiles,
        hysteresis_threshold = excluded.hysteresis_threshold,
        is_enabled = excluded.is_enabled,
        updated_at = excluded.updated_at
    `);

    stmt.run(
      updated.seriesId,
      updated.readingFlow,
      updated.predictionHorizonMs,
      updated.recencyTauMs,
      updated.maxPrefetchTiles,
      updated.hysteresisThreshold,
      updated.isEnabled ? 1 : 0,
      updated.createdAt,
      updated.updatedAt
    );

    this.cache.set(updated.seriesId, updated);
    return updated;
  }

  public generateETag(profile: TilePrefetchProfile): string {
    const payload = `${profile.seriesId}:${profile.readingFlow}:${profile.predictionHorizonMs}:${profile.recencyTauMs}:${profile.maxPrefetchTiles}:${profile.hysteresisThreshold}:${profile.isEnabled}:${profile.updatedAt}`;
    return createHash('md5').update(payload).digest('hex');
  }

  public clearCache(): void {
    this.cache.clear();
  }
}
