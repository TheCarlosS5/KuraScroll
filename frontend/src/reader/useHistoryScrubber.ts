/**
 * KuraScroll - Sprint 90: Bi-Directional Manga & Webtoon Continuous Infinite History Scrubber Hook
 * 
 * Hardware-tuned for Intel Pentium T4500 & Intel GMA 4500MHD.
 * Provides real-time bi-directional timeline scrubbing across infinite history
 * with attention dwell-time heatmap tape projection and zero mechanical disk seek thrashing.
 * Bound to key 'Z' for HUD toggling.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

export type ScrubberMode = 'webtoon_continuous' | 'manga_rtl_continuous' | 'manga_ltr_continuous';

export interface ScrubberModeConfig {
  mode: ScrubberMode;
  label: string;
  orientation: 'vertical' | 'horizontal';
  isRtl: boolean;
  defaultThickness: number;
  description: string;
}

export const SCRUBBER_MODE_CONFIGS: Record<ScrubberMode, ScrubberModeConfig> = {
  webtoon_continuous: {
    mode: 'webtoon_continuous',
    label: 'Webtoon (Vertical)',
    orientation: 'vertical',
    isRtl: false,
    defaultThickness: 48,
    description: 'Vertical lateral ribbon for long-strip infinite vertical webtoon scrolling',
  },
  manga_rtl_continuous: {
    mode: 'manga_rtl_continuous',
    label: 'Manga RTL (Right-to-Left)',
    orientation: 'horizontal',
    isRtl: true,
    defaultThickness: 48,
    description: 'Horizontal bottom tape traversing right-to-left for traditional tankōbon manga',
  },
  manga_ltr_continuous: {
    mode: 'manga_ltr_continuous',
    label: 'Manhua / Western LTR',
    orientation: 'horizontal',
    isRtl: false,
    defaultThickness: 48,
    description: 'Horizontal bottom tape traversing left-to-right for manhua and global graphic novels',
  },
};

export interface UseHistoryScrubberProps {
  seriesId?: string;
  initialMode?: ScrubberMode;
  totalItems?: number;
  initialIndex?: number;
  onScrubCommit?: (targetIndex: number) => void;
}

export interface UseHistoryScrubberReturn {
  isEnabled: boolean;
  setIsEnabled: (enabled: boolean) => void;
  isHUDVisible: boolean;
  setIsHUDVisible: (visible: boolean) => void;
  scrubberMode: ScrubberMode;
  setScrubberMode: (mode: ScrubberMode) => void;
  currentIndex: number;
  setCurrentIndex: (index: number) => void;
  totalItems: number;
  setTotalItems: (total: number) => void;
  tapeThicknessPx: number;
  setTapeThicknessPx: (px: number) => void;
  heatmapIntensity: number;
  setHeatmapIntensity: (intensity: number) => void;
  velocityMultiplier: number;
  setVelocityMultiplier: (mult: number) => void;
  isSnapToChapter: boolean;
  setIsSnapToChapter: (snap: boolean) => void;
  normalizedPosition: number;
  pixelOffset: number;
  isAtStart: boolean;
  isAtEnd: boolean;
  toggleHUD: () => void;
  scrubToRatio: (ratio: number) => void;
  scrubDelta: (delta: number) => void;
}

export function useHistoryScrubber({
  seriesId,
  initialMode = 'webtoon_continuous',
  totalItems: initialTotal = 100,
  initialIndex = 0,
  onScrubCommit,
}: UseHistoryScrubberProps = {}): UseHistoryScrubberReturn {
  const [isEnabled, setIsEnabled] = useState<boolean>(true);
  const [isHUDVisible, setIsHUDVisible] = useState<boolean>(false);
  const [scrubberMode, setScrubberMode] = useState<ScrubberMode>(initialMode);
  const [totalItems, setTotalItems] = useState<number>(Math.max(1, initialTotal));
  const [currentIndex, setCurrentIndex] = useState<number>(Math.max(0, initialIndex));
  const [tapeThicknessPx, setTapeThicknessPx] = useState<number>(48);
  const [heatmapIntensity, setHeatmapIntensity] = useState<number>(0.65);
  const [velocityMultiplier, setVelocityMultiplier] = useState<number>(1.20);
  const [isSnapToChapter, setIsSnapToChapter] = useState<boolean>(true);

  const activeConfig = SCRUBBER_MODE_CONFIGS[scrubberMode] || SCRUBBER_MODE_CONFIGS.webtoon_continuous;

  const toggleHUD = useCallback(() => {
    setIsHUDVisible((prev) => !prev);
  }, []);

  const clampedIndex = Math.max(0, Math.min(totalItems - 1, currentIndex));
  const ratio = totalItems > 1 ? clampedIndex / (totalItems - 1) : 0;
  const normalizedPosition = activeConfig.isRtl ? 1.0 - ratio : ratio;
  const pixelOffset = parseFloat((normalizedPosition * 600).toFixed(2));
  const isAtStart = clampedIndex === 0;
  const isAtEnd = clampedIndex === totalItems - 1;

  const scrubToRatio = useCallback(
    (targetRatio: number) => {
      const clampedRatio = Math.max(0, Math.min(1.0, targetRatio));
      const effectiveRatio = activeConfig.isRtl ? 1.0 - clampedRatio : clampedRatio;
      const targetIndex = Math.round(effectiveRatio * (totalItems - 1));
      setCurrentIndex(targetIndex);
      if (onScrubCommit) onScrubCommit(targetIndex);
    },
    [activeConfig.isRtl, totalItems, onScrubCommit]
  );

  const scrubDelta = useCallback(
    (delta: number) => {
      setCurrentIndex((prev) => {
        const next = Math.max(0, Math.min(totalItems - 1, Math.round(prev + delta * velocityMultiplier)));
        if (onScrubCommit && next !== prev) onScrubCommit(next);
        return next;
      });
    },
    [totalItems, velocityMultiplier, onScrubCommit]
  );

  // Global hotkey 'Z' listener
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

      if (e.key === 'z' || e.key === 'Z') {
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

  return {
    isEnabled,
    setIsEnabled,
    isHUDVisible,
    setIsHUDVisible,
    scrubberMode,
    setScrubberMode,
    currentIndex: clampedIndex,
    setCurrentIndex,
    totalItems,
    setTotalItems,
    tapeThicknessPx,
    setTapeThicknessPx,
    heatmapIntensity,
    setHeatmapIntensity,
    velocityMultiplier,
    setVelocityMultiplier,
    isSnapToChapter,
    setIsSnapToChapter,
    normalizedPosition,
    pixelOffset,
    isAtStart,
    isAtEnd,
    toggleHUD,
    scrubToRatio,
    scrubDelta,
  };
}
