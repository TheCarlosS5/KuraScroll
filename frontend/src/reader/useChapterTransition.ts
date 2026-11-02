/**
 * KuraScroll Intelligent Chapter Transition Pre-Baking Hook
 * Sprint 79 - Zero-Latency Chapter Flip & Continuous Visual Curtain
 *
 * Coordinates chapter boundary detection, auto-advance timers,
 * pre-baking trigger notifications, and keyboard shortcut 'C'.
 * Hardware-tuned for Intel Pentium T4500 & Intel GMA 4500MHD (0 blur, 0 CLS).
 */

import { useState, useCallback, useEffect, useRef } from 'react';

export type TransitionStyle = 'curtain' | 'infinite_scroll' | 'page_turn';

export interface NextChapterInfo {
  id: string;
  title: string;
  chapterNumber: number;
  estimatedReadMinutes?: number;
}

export interface UseChapterTransitionOptions {
  defaultEnabled?: boolean;
  defaultStyle?: TransitionStyle;
  defaultOffset?: number;
  defaultDelayMs?: number;
  defaultShowSummary?: boolean;
  enableKeyboard?: boolean;
  onAdvance?: (nextChapterId: string) => void;
}

export function useChapterTransition({
  defaultEnabled = true,
  defaultStyle = 'curtain',
  defaultOffset = 3,
  defaultDelayMs = 1500,
  defaultShowSummary = true,
  enableKeyboard = true,
  onAdvance,
}: UseChapterTransitionOptions = {}) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isEnabled, setIsEnabled] = useState<boolean>(defaultEnabled);
  const [transitionStyle, setTransitionStyleState] = useState<TransitionStyle>(defaultStyle);
  const [prebakeTriggerPageOffset, setOffsetState] = useState<number>(defaultOffset);
  const [autoAdvanceDelayMs, setDelayMsState] = useState<number>(defaultDelayMs);
  const [showReadingSummary, setShowSummaryState] = useState<boolean>(defaultShowSummary);

  const [isCurtainVisible, setIsCurtainVisible] = useState<boolean>(false);
  const [nextChapter, setNextChapter] = useState<NextChapterInfo | null>(null);
  const [autoAdvanceProgress, setAutoAdvanceProgress] = useState<number>(0);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const openHUD = useCallback(() => setIsOpen(true), []);
  const closeHUD = useCallback(() => setIsOpen(false), []);
  const toggleHUD = useCallback(() => setIsOpen((prev) => !prev), []);
  const toggleEnabled = useCallback(() => setIsEnabled((prev) => !prev), []);

  const setTransitionStyle = useCallback((s: TransitionStyle) => {
    setTransitionStyleState(s);
  }, []);

  const setPrebakeTriggerPageOffset = useCallback((o: number) => {
    const clamped = Math.max(1, Math.min(5, o));
    setOffsetState(clamped);
  }, []);

  const setAutoAdvanceDelayMs = useCallback((d: number) => {
    const clamped = Math.max(0, Math.min(5000, d));
    setDelayMsState(clamped);
  }, []);

  const setShowReadingSummary = useCallback((val: boolean) => {
    setShowSummaryState(val);
  }, []);

  const resetToDefaults = useCallback(() => {
    setIsEnabled(true);
    setTransitionStyleState('curtain');
    setOffsetState(3);
    setDelayMsState(1500);
    setShowSummaryState(true);
  }, []);

  const triggerCurtain = useCallback((info: NextChapterInfo | null) => {
    if (!isEnabled) {
      if (info && onAdvance) onAdvance(info.id);
      return;
    }

    setNextChapter(info);
    setIsCurtainVisible(true);
    setAutoAdvanceProgress(0);
  }, [isEnabled, onAdvance]);

  const dismissCurtain = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsCurtainVisible(false);
  }, []);

  const advanceImmediately = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsCurtainVisible(false);
    if (nextChapter && onAdvance) {
      onAdvance(nextChapter.id);
    }
  }, [nextChapter, onAdvance]);

  // Auto-advance timer when curtain is displayed
  useEffect(() => {
    if (!isCurtainVisible || !nextChapter || autoAdvanceDelayMs <= 0) {
      return;
    }

    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(100, Math.round((elapsed / autoAdvanceDelayMs) * 100));
      setAutoAdvanceProgress(progress);

      if (elapsed >= autoAdvanceDelayMs) {
        clearInterval(interval);
        advanceImmediately();
      }
    }, 50);

    return () => clearInterval(interval);
  }, [isCurtainVisible, nextChapter, autoAdvanceDelayMs, advanceImmediately]);

  // Keyboard shortcut listener ('C' to toggle HUD, 'Space'/'Enter' to advance)
  useEffect(() => {
    if (!enableKeyboard) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
        return;
      }

      if ((e.key === 'c' || e.key === 'C') && !isCurtainVisible) {
        e.preventDefault();
        toggleHUD();
      } else if (isCurtainVisible && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        advanceImmediately();
      } else if (isCurtainVisible && e.key === 'Escape') {
        e.preventDefault();
        dismissCurtain();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enableKeyboard, isCurtainVisible, toggleHUD, advanceImmediately, dismissCurtain]);

  return {
    isOpen,
    openHUD,
    closeHUD,
    toggleHUD,
    isEnabled,
    toggleEnabled,
    transitionStyle,
    setTransitionStyle,
    prebakeTriggerPageOffset,
    setPrebakeTriggerPageOffset,
    autoAdvanceDelayMs,
    setAutoAdvanceDelayMs,
    showReadingSummary,
    setShowReadingSummary,
    isCurtainVisible,
    nextChapter,
    autoAdvanceProgress,
    triggerCurtain,
    dismissCurtain,
    advanceImmediately,
    resetToDefaults,
  };
}
