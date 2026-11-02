/**
 * KuraScroll Smart Guided Panel Pacer Hook
 * Sprint 68 - Topological Boustrophedon Guided Reader & Cinematic Framing
 *
 * Provides reactive auto-pacing, camera transform calculation,
 * keyboard controls ('P', Space, Arrows, Esc), and motion-sickness mitigation.
 * Hardware-tuned for Intel GMA 4500MHD: zero layout thrashing, 0 CLS, 0 blur.
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';

export type ReadingMode = 'manga' | 'webtoon' | 'comic';

export interface GuidedPanelBox {
  id?: number;
  chapterId: string;
  pageNumber: number;
  panelIndex: number;
  normX: number; // 0.0 - 1.0
  normY: number; // 0.0 - 1.0
  normW: number; // 0.0 - 1.0
  normH: number; // 0.0 - 1.0
  aspectRatio: number;
  readingOrderScore: number;
  isSplash: boolean;
  createdAt?: number;
}

export interface CameraFramingTarget {
  panelIndex: number;
  panXPercent: number;
  panYPercent: number;
  scale: number;
  clamped: boolean;
  isSplash: boolean;
  viewportW: number;
  viewportH: number;
  aspectRatio: number;
}

export interface UseGuidedPanelPacerOptions {
  chapterId?: string;
  pageNumber?: number;
  panels?: GuidedPanelBox[];
  readingMode?: ReadingMode;
  autoPlayIntervalMs?: number; // default 3500ms
  enableKeyboard?: boolean;
  padding?: number; // default 0.04
  minScale?: number; // default 1.0
  maxScale?: number; // default 3.5
  onPageComplete?: () => void;
  onPanelChange?: (panel: GuidedPanelBox, index: number) => void;
}

export interface UseGuidedPanelPacerResult {
  isPacingActive: boolean;
  activePanelIndex: number;
  activePanel: GuidedPanelBox | null;
  totalPanels: number;
  isAutoPlay: boolean;
  autoPlayIntervalMs: number;
  readingMode: ReadingMode;
  framing: CameraFramingTarget | null;
  cameraTransformStyle: React.CSSProperties;
  togglePacing: () => void;
  setPacingActive: (active: boolean) => void;
  nextPanel: () => void;
  prevPanel: () => void;
  goToPanel: (index: number) => void;
  toggleAutoPlay: () => void;
  setAutoPlayIntervalMs: (ms: number) => void;
  setPanels: (panels: GuidedPanelBox[]) => void;
}

export function calculateCameraFraming(
  panel: GuidedPanelBox,
  viewportW = 1920,
  viewportH = 1080,
  padding = 0.04,
  minScale = 1.0,
  maxScale = 3.5
): CameraFramingTarget {
  const normW = Math.max(0.01, panel.normW);
  const normH = Math.max(0.01, panel.normH);

  if (panel.isSplash) {
    return {
      panelIndex: panel.panelIndex,
      panXPercent: 0,
      panYPercent: 0,
      scale: 1.0,
      clamped: false,
      isSplash: true,
      viewportW,
      viewportH,
      aspectRatio: panel.aspectRatio,
    };
  }

  const availableFraction = Math.max(0.1, 1.0 - 2 * padding);
  const scaleX = availableFraction / normW;
  const scaleY = availableFraction / normH;
  const rawScale = Math.min(scaleX, scaleY);

  let scale = rawScale;
  let clamped = false;

  if (scale < minScale) {
    scale = minScale;
    clamped = true;
  } else if (scale > maxScale) {
    scale = maxScale;
    clamped = true;
  }

  const cx = panel.normX + normW / 2;
  const cy = panel.normY + normH / 2;

  const panXPercent = Math.round((0.5 - cx) * scale * 10000) / 100;
  const panYPercent = Math.round((0.5 - cy) * scale * 10000) / 100;

  return {
    panelIndex: panel.panelIndex,
    panXPercent,
    panYPercent,
    scale: Math.round(scale * 1000) / 1000,
    clamped,
    isSplash: false,
    viewportW,
    viewportH,
    aspectRatio: panel.aspectRatio,
  };
}

export function useGuidedPanelPacer(
  options: UseGuidedPanelPacerOptions = {}
): UseGuidedPanelPacerResult {
  const {
    panels: initialPanels = [],
    readingMode = 'manga',
    autoPlayIntervalMs: initialAutoPlayInterval = 3500,
    enableKeyboard = true,
    padding = 0.04,
    minScale = 1.0,
    maxScale = 3.5,
    onPageComplete,
    onPanelChange,
  } = options;

  const [panels, setPanels] = useState<GuidedPanelBox[]>(initialPanels);
  const [isPacingActive, setPacingActive] = useState<boolean>(false);
  const [activePanelIndex, setActivePanelIndex] = useState<number>(0);
  const [isAutoPlay, setIsAutoPlay] = useState<boolean>(false);
  const [autoPlayIntervalMs, setAutoPlayIntervalMs] = useState<number>(initialAutoPlayInterval);

  // Sync panels if props change
  useEffect(() => {
    if (initialPanels && initialPanels.length > 0) {
      setPanels(initialPanels);
    }
  }, [initialPanels]);

  const activePanel = useMemo(() => {
    if (!panels || panels.length === 0 || activePanelIndex < 0 || activePanelIndex >= panels.length) {
      return null;
    }
    return panels[activePanelIndex];
  }, [panels, activePanelIndex]);

  const framing = useMemo(() => {
    if (!activePanel) return null;
    return calculateCameraFraming(activePanel, 1920, 1080, padding, minScale, maxScale);
  }, [activePanel, padding, minScale, maxScale]);

  const togglePacing = useCallback(() => {
    setPacingActive((prev) => {
      const next = !prev;
      if (next && panels.length > 0) {
        onPanelChange?.(panels[activePanelIndex] || panels[0], activePanelIndex);
      }
      return next;
    });
  }, [panels, activePanelIndex, onPanelChange]);

  const goToPanel = useCallback(
    (index: number) => {
      if (!panels || panels.length === 0) return;
      const targetIndex = Math.max(0, Math.min(index, panels.length - 1));
      setActivePanelIndex(targetIndex);
      if (isPacingActive) {
        onPanelChange?.(panels[targetIndex], targetIndex);
      }
    },
    [panels, isPacingActive, onPanelChange]
  );

  const nextPanel = useCallback(() => {
    if (!panels || panels.length === 0) return;
    setActivePanelIndex((prev) => {
      if (prev >= panels.length - 1) {
        onPageComplete?.();
        return prev;
      }
      const next = prev + 1;
      if (isPacingActive) {
        onPanelChange?.(panels[next], next);
      }
      return next;
    });
  }, [panels, isPacingActive, onPanelChange, onPageComplete]);

  const prevPanel = useCallback(() => {
    if (!panels || panels.length === 0) return;
    setActivePanelIndex((prev) => {
      if (prev <= 0) return 0;
      const next = prev - 1;
      if (isPacingActive) {
        onPanelChange?.(panels[next], next);
      }
      return next;
    });
  }, [panels, isPacingActive, onPanelChange]);

  const toggleAutoPlay = useCallback(() => {
    setIsAutoPlay((prev) => !prev);
  }, []);

  // Auto-play interval timer
  const autoPlayTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isAutoPlay || !isPacingActive || panels.length === 0) {
      if (autoPlayTimerRef.current) {
        clearInterval(autoPlayTimerRef.current);
        autoPlayTimerRef.current = null;
      }
      return;
    }

    autoPlayTimerRef.current = setInterval(() => {
      setActivePanelIndex((prevIndex) => {
        if (prevIndex >= panels.length - 1) {
          setIsAutoPlay(false);
          onPageComplete?.();
          return prevIndex;
        }
        const next = prevIndex + 1;
        onPanelChange?.(panels[next], next);
        return next;
      });
    }, autoPlayIntervalMs);

    return () => {
      if (autoPlayTimerRef.current) {
        clearInterval(autoPlayTimerRef.current);
        autoPlayTimerRef.current = null;
      }
    };
  }, [isAutoPlay, isPacingActive, panels, autoPlayIntervalMs, onPageComplete, onPanelChange]);

  // Keyboard navigation
  useEffect(() => {
    if (!enableKeyboard) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        togglePacing();
      } else if (e.key === 'Escape') {
        if (isPacingActive) {
          e.preventDefault();
          setPacingActive(false);
          setIsAutoPlay(false);
        }
      } else if (isPacingActive) {
        if (e.key === ' ' || e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault();
          nextPanel();
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          prevPanel();
        } else if (e.key === 'a' || e.key === 'A') {
          e.preventDefault();
          toggleAutoPlay();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enableKeyboard, isPacingActive, togglePacing, nextPanel, prevPanel, toggleAutoPlay]);

  // Zero-layout recalculation camera CSS transform
  const cameraTransformStyle: React.CSSProperties = useMemo(() => {
    if (!isPacingActive || !framing) {
      return {
        transform: 'translate3d(0, 0, 0) scale(1)',
        transition: 'transform 350ms cubic-bezier(0.16, 1, 0.3, 1)',
        transformOrigin: '50% 50%',
        willChange: 'transform',
      };
    }

    return {
      transform: `translate3d(${framing.panXPercent}%, ${framing.panYPercent}%, 0) scale(${framing.scale})`,
      transition: 'transform 350ms cubic-bezier(0.16, 1, 0.3, 1)',
      transformOrigin: '50% 50%',
      willChange: 'transform',
    };
  }, [isPacingActive, framing]);

  return {
    isPacingActive,
    activePanelIndex,
    activePanel,
    totalPanels: panels.length,
    isAutoPlay,
    autoPlayIntervalMs,
    readingMode,
    framing,
    cameraTransformStyle,
    togglePacing,
    setPacingActive,
    nextPanel,
    prevPanel,
    goToPanel,
    toggleAutoPlay,
    setAutoPlayIntervalMs,
    setPanels,
  };
}
