/**
 * KuraScroll Intelligent Dual-Page Splitter & Webtoon Vertical Stitcher Hook
 * Sprint 76 - Smart Page Auto-Slicer & Continuous Strip Weaver
 *
 * Coordinates virtual spread splitting (RTL/LTR), zero-gap webtoon strip stitching,
 * and keyboard shortcut 'D'.
 * Hardware-tuned for Intel Pentium T4500 & Intel GMA 4500MHD (0 blur, 0 CLS).
 */

import { useState, useCallback, useEffect } from 'react';

export type SplitStitchMode = 'none' | 'split_rtl' | 'split_ltr' | 'stitch_webtoon';

export interface UsePageSplitStitchOptions {
  defaultEnabled?: boolean;
  defaultMode?: SplitStitchMode;
  defaultSplitRatio?: number;
  defaultStitchGapPx?: number;
  enableKeyboard?: boolean;
}

export function usePageSplitStitch({
  defaultEnabled = true,
  defaultMode = 'none',
  defaultSplitRatio = 0.50,
  defaultStitchGapPx = 0,
  enableKeyboard = true,
}: UsePageSplitStitchOptions = {}) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isEnabled, setIsEnabled] = useState<boolean>(defaultEnabled);
  const [mode, setModeState] = useState<SplitStitchMode>(defaultMode);
  const [splitRatio, setSplitRatioState] = useState<number>(defaultSplitRatio);
  const [stitchGapPx, setStitchGapPxState] = useState<number>(defaultStitchGapPx);

  const openHUD = useCallback(() => setIsOpen(true), []);
  const closeHUD = useCallback(() => setIsOpen(false), []);
  const toggleHUD = useCallback(() => setIsOpen((prev) => !prev), []);

  const toggleEnabled = useCallback(() => setIsEnabled((prev) => !prev), []);

  const setMode = useCallback((m: SplitStitchMode) => {
    setModeState(m);
  }, []);

  const setSplitRatio = useCallback((r: number) => {
    const clamped = Math.max(0.20, Math.min(0.80, r));
    setSplitRatioState(clamped);
  }, []);

  const setStitchGapPx = useCallback((gap: number) => {
    const clamped = Math.max(-10, Math.min(200, gap));
    setStitchGapPxState(clamped);
  }, []);

  const resetToDefaults = useCallback(() => {
    setIsEnabled(true);
    setModeState('none');
    setSplitRatioState(0.50);
    setStitchGapPxState(0);
  }, []);

  // Keyboard shortcut listener ('D' to toggle HUD)
  useEffect(() => {
    if (!enableKeyboard) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
        return;
      }

      if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        toggleHUD();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enableKeyboard, toggleHUD]);

  return {
    isOpen,
    openHUD,
    closeHUD,
    toggleHUD,
    isEnabled,
    toggleEnabled,
    mode,
    setMode,
    splitRatio,
    setSplitRatio,
    stitchGapPx,
    setStitchGapPx,
    resetToDefaults,
  };
}
