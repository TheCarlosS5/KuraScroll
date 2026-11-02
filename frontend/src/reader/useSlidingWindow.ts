/**
 * KuraScroll - Sprint 86: Continuous Page In-Viewport Micro-Cache & Sliding Window Hook
 * 
 * Tuned for low memory & Intel GMA 4500MHD texture ceiling.
 * Bound to key 'W' for HUD toggling.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

export type SlidingWindowMode = 'conservative' | 'aggressive' | 'preload_heavy';

export interface SlidingWindowConfig {
  windowSize: number;
  forwardBuffer: number;
  backwardBuffer: number;
  maxCachedBytes: number;
  label: string;
}

export const SLIDING_WINDOW_CONFIGS: Record<SlidingWindowMode, SlidingWindowConfig> = {
  conservative: {
    windowSize: 5,
    forwardBuffer: 3,
    backwardBuffer: 2,
    maxCachedBytes: 26214400, // 25MB
    label: 'Conservative (HDD Optimized)',
  },
  aggressive: {
    windowSize: 3,
    forwardBuffer: 2,
    backwardBuffer: 1,
    maxCachedBytes: 15728640, // 15MB
    label: 'Aggressive (Low VRAM)',
  },
  preload_heavy: {
    windowSize: 8,
    forwardBuffer: 5,
    backwardBuffer: 3,
    maxCachedBytes: 41943040, // 40MB
    label: 'Preload Heavy (SSD / High-RAM)',
  },
};

export interface UseSlidingWindowProps {
  seriesId?: string;
  totalPages?: number;
  initialPage?: number;
  initialMode?: SlidingWindowMode;
  onPageEvicted?: (pageIndex: number) => void;
  onPagePrefetch?: (pageIndices: number[]) => void;
}

export interface UseSlidingWindowReturn {
  isEnabled: boolean;
  setIsEnabled: (enabled: boolean) => void;
  isHUDVisible: boolean;
  setIsHUDVisible: (visible: boolean) => void;
  mode: SlidingWindowMode;
  setMode: (mode: SlidingWindowMode) => void;
  currentIndex: number;
  startIndex: number;
  endIndex: number;
  activeCount: number;
  activeIndices: number[];
  prefetchIndices: number[];
  evictedCount: number;
  estimatedMemoryMB: number;
  updateViewportIndex: (index: number, totalCount?: number) => void;
  toggleHUD: () => void;
  isPageActive: (index: number) => boolean;
}

export function useSlidingWindow({
  seriesId,
  totalPages = 0,
  initialPage = 0,
  initialMode = 'conservative',
  onPageEvicted,
  onPagePrefetch,
}: UseSlidingWindowProps = {}): UseSlidingWindowReturn {
  const [isEnabled, setIsEnabled] = useState<boolean>(true);
  const [isHUDVisible, setIsHUDVisible] = useState<boolean>(false);
  const [mode, setMode] = useState<SlidingWindowMode>(initialMode);
  const [currentIndex, setCurrentIndex] = useState<number>(initialPage);
  const [total, setTotal] = useState<number>(totalPages);

  useEffect(() => {
    setTotal(totalPages);
  }, [totalPages]);

  const config = SLIDING_WINDOW_CONFIGS[mode] || SLIDING_WINDOW_CONFIGS.conservative;

  const { startIndex, endIndex, activeIndices, prefetchIndices, activeCount, evictedCount, estimatedMemoryMB } =
    useMemo(() => {
      if (!isEnabled || total <= 0) {
        const fullIndices = Array.from({ length: Math.max(0, total) }, (_, i) => i);
        return {
          startIndex: 0,
          endIndex: Math.max(0, total - 1),
          activeIndices: fullIndices,
          prefetchIndices: [],
          activeCount: total,
          evictedCount: 0,
          estimatedMemoryMB: (total * 2.5),
        };
      }

      const clampedCurrent = Math.max(0, Math.min(total - 1, currentIndex));
      const start = Math.max(0, clampedCurrent - config.backwardBuffer);
      const end = Math.min(total - 1, clampedCurrent + config.forwardBuffer);
      const count = end - start + 1;

      const active: number[] = [];
      for (let i = start; i <= end; i++) {
        active.push(i);
      }

      const prefetch: number[] = [];
      for (let p = clampedCurrent + 1; p <= end; p++) {
        prefetch.push(p);
      }

      const evicted = total - count;
      const memMB = parseFloat((count * 2.5).toFixed(1)); // ~2.5MB per full page RGBA texture

      return {
        startIndex: start,
        endIndex: end,
        activeIndices: active,
        prefetchIndices: prefetch,
        activeCount: count,
        evictedCount: evicted,
        estimatedMemoryMB: memMB,
      };
    }, [isEnabled, total, currentIndex, config]);

  const updateViewportIndex = useCallback((index: number, newTotal?: number) => {
    if (newTotal !== undefined) {
      setTotal(newTotal);
    }
    setCurrentIndex(index);
  }, []);

  const toggleHUD = useCallback(() => {
    setIsHUDVisible((prev) => !prev);
  }, []);

  const isPageActive = useCallback(
    (index: number) => {
      if (!isEnabled) return true;
      return index >= startIndex && index <= endIndex;
    },
    [isEnabled, startIndex, endIndex]
  );

  // Global Hotkey 'W' Listener for HUD toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === 'w' || e.key === 'W') {
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          toggleHUD();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [toggleHUD]);

  // Trigger optional callbacks
  useEffect(() => {
    if (onPagePrefetch && prefetchIndices.length > 0) {
      onPagePrefetch(prefetchIndices);
    }
  }, [prefetchIndices, onPagePrefetch]);

  return {
    isEnabled,
    setIsEnabled,
    isHUDVisible,
    setIsHUDVisible,
    mode,
    setMode,
    currentIndex,
    startIndex,
    endIndex,
    activeCount,
    activeIndices,
    prefetchIndices,
    evictedCount,
    estimatedMemoryMB,
    updateViewportIndex,
    toggleHUD,
    isPageActive,
  };
}
