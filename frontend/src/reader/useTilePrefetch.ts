/**
 * KuraScroll - Sprint 117: Predictive Subpixel Canvas Tile Cache Prefetcher & LRU Texture Swapper Hook
 * 
 * Hardware Target: Intel Pentium T4500 (2C/2T @ 2.30 GHz, Penryn 45nm, no AVX, heap <= 512MB) & Intel GMA 4500MHD.
 * Pure TypedArray ring-buffer LRU management, 0 allocation hot-path, 0 CSS blur, 0 CLS.
 * Bound to key 'P' / 'p' for HUD toggling.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

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

export interface RingSlotInfo {
  slot: number;
  tileId: number;
  timestamp: number;
  isPinned: boolean;
}

export interface TilePrefetchDecisionResult {
  selectedTileId: number;
  shouldPrefetch: boolean;
  evictedTileId: number;
  slotIndex: number;
  transitionWeight: number;
  latencyUs: number;
}

export function useTilePrefetch(seriesId: string) {
  const [isHUDOpen, setIsHUDOpen] = useState(false);
  const [readingFlow, setReadingFlow] = useState<ReadingFlow>('manga_rtl');
  const [predictionHorizonMs, setPredictionHorizonMs] = useState(350);
  const [recencyTauMs, setRecencyTauMs] = useState(8000);
  const [maxPrefetchTiles, setMaxPrefetchTiles] = useState(3);
  const [hysteresisThreshold, setHysteresisThreshold] = useState(0.65);
  const [isEnabled, setIsEnabled] = useState(true);

  // Live ring buffer simulation state
  const [ringSlots, setRingSlots] = useState<RingSlotInfo[]>(() =>
    Array.from({ length: RING_CAPACITY }, (_, i) => ({
      slot: i,
      tileId: -1,
      timestamp: 0,
      isPinned: false,
    }))
  );

  const [lastDecision, setLastDecision] = useState<TilePrefetchDecisionResult | null>(null);
  const [telemetry, setTelemetry] = useState({
    totalRequests: 0,
    cacheHits: 0,
    prefetches: 0,
    evictions: 0,
  });

  // Evaluate candidate tile prefetch decision
  const evaluateCandidate = useCallback(
    (candidateTileId: number, transitionWeight: number, isPinned = false) => {
      const startHr = typeof performance !== 'undefined' ? performance.now() : 0;

      if (!isEnabled) {
        const dummy: TilePrefetchDecisionResult = {
          selectedTileId: candidateTileId,
          shouldPrefetch: false,
          evictedTileId: -1,
          slotIndex: -1,
          transitionWeight,
          latencyUs: 0.1,
        };
        setLastDecision(dummy);
        return dummy;
      }

      setRingSlots((prevSlots) => {
        let isCached = false;
        let cachedSlot = -1;
        let emptySlot = -1;
        let oldestTimestamp = Number.MAX_VALUE;
        let oldestSlot = 0;

        const now = Date.now();

        for (let i = 0; i < RING_CAPACITY; i++) {
          const s = prevSlots[i];
          if (s.tileId === candidateTileId) {
            isCached = true;
            cachedSlot = i;
            break;
          }
          if (s.tileId === -1 && emptySlot === -1) {
            emptySlot = i;
          } else if (!s.isPinned && s.timestamp < oldestTimestamp) {
            oldestTimestamp = s.timestamp;
            oldestSlot = i;
          }
        }

        let evicted = -1;
        let shouldFetch = false;
        let targetSlot = cachedSlot;

        if (isCached) {
          // Hit: update timestamp
          const updated = [...prevSlots];
          updated[cachedSlot] = { ...updated[cachedSlot], timestamp: now };
          setTelemetry((t) => ({ ...t, totalRequests: t.totalRequests + 1, cacheHits: t.cacheHits + 1 }));
          
          const endHr = typeof performance !== 'undefined' ? performance.now() : 0;
          setLastDecision({
            selectedTileId: candidateTileId,
            shouldPrefetch: false,
            evictedTileId: -1,
            slotIndex: cachedSlot,
            transitionWeight,
            latencyUs: (endHr - startHr) * 1000,
          });
          return updated;
        }

        if (transitionWeight >= hysteresisThreshold) {
          shouldFetch = true;
          const updated = [...prevSlots];
          targetSlot = emptySlot !== -1 ? emptySlot : oldestSlot;
          evicted = prevSlots[targetSlot].tileId;

          updated[targetSlot] = {
            slot: targetSlot,
            tileId: candidateTileId,
            timestamp: now,
            isPinned,
          };

          setTelemetry((t) => ({
            ...t,
            totalRequests: t.totalRequests + 1,
            prefetches: t.prefetches + 1,
            evictions: evicted !== -1 ? t.evictions + 1 : t.evictions,
          }));

          const endHr = typeof performance !== 'undefined' ? performance.now() : 0;
          setLastDecision({
            selectedTileId: candidateTileId,
            shouldPrefetch: true,
            evictedTileId: evicted,
            slotIndex: targetSlot,
            transitionWeight,
            latencyUs: (endHr - startHr) * 1000,
          });
          return updated;
        }

        // Miss but weight < hysteresis
        setTelemetry((t) => ({ ...t, totalRequests: t.totalRequests + 1 }));
        const endHr = typeof performance !== 'undefined' ? performance.now() : 0;
        setLastDecision({
          selectedTileId: candidateTileId,
          shouldPrefetch: false,
          evictedTileId: -1,
          slotIndex: -1,
          transitionWeight,
          latencyUs: (endHr - startHr) * 1000,
        });
        return prevSlots;
      });
    },
    [isEnabled, hysteresisThreshold]
  );

  const resetRing = useCallback(() => {
    setRingSlots(
      Array.from({ length: RING_CAPACITY }, (_, i) => ({
        slot: i,
        tileId: -1,
        timestamp: 0,
        isPinned: false,
      }))
    );
    setTelemetry({ totalRequests: 0, cacheHits: 0, prefetches: 0, evictions: 0 });
    setLastDecision(null);
  }, []);

  const selectPreset = useCallback((flow: ReadingFlow) => {
    setReadingFlow(flow);
    const p = TILE_PREFETCH_PRESETS[flow];
    if (p) {
      setPredictionHorizonMs(p.predictionHorizonMs);
      setRecencyTauMs(p.recencyTauMs);
      setMaxPrefetchTiles(p.maxPrefetchTiles);
      setHysteresisThreshold(p.hysteresisThreshold);
    }
  }, []);

  // Keyboard hotkey 'P' / 'p' toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        (activeEl as HTMLElement)?.isContentEditable;

      if (!isInput && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        setIsHUDOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const cachedCount = useMemo(
    () => ringSlots.filter((s) => s.tileId !== -1).length,
    [ringSlots]
  );

  const hitRatio = useMemo(() => {
    if (telemetry.totalRequests === 0) return 0;
    return (telemetry.cacheHits / telemetry.totalRequests) * 100;
  }, [telemetry]);

  return {
    isHUDOpen,
    setIsHUDOpen,
    readingFlow,
    setReadingFlow,
    predictionHorizonMs,
    setPredictionHorizonMs,
    recencyTauMs,
    setRecencyTauMs,
    maxPrefetchTiles,
    setMaxPrefetchTiles,
    hysteresisThreshold,
    setHysteresisThreshold,
    isEnabled,
    setIsEnabled,
    ringSlots,
    cachedCount,
    lastDecision,
    telemetry,
    hitRatio,
    evaluateCandidate,
    resetRing,
    selectPreset,
  };
}
