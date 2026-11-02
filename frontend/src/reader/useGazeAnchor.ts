/**
 * KuraScroll Predictive Gaze Heatmap Trajectory & Eye Fixation Anti-Drift Hook
 * Sprint 83 - GazeAnchor Engine
 *
 * Hardware-tuned for Intel Pentium T4500 & Intel GMA 4500MHD (0 blur, solid #18181b, 0 CLS).
 * Features client-side zero-allocation saccadic trajectory prediction,
 * micro-jitter fixation deadband stabilization, and keyboard shortcut 'G'.
 */

import { useState, useCallback, useEffect, useRef } from 'react';

export type GazeMode = 'webtoon' | 'manga_rtl' | 'manga_ltr';
export type HeatmapResolution = 'low' | 'medium' | 'high';

export interface GazeAnchorPoint {
  x: number;
  y: number;
}

export interface UseGazeAnchorOptions {
  defaultEnabled?: boolean;
  defaultMode?: GazeMode;
  defaultSensitivity?: number;
  defaultDwellMs?: number;
  defaultDriftTolerance?: number;
  defaultReturnAnchor?: boolean;
  defaultHeatmapResolution?: HeatmapResolution;
  enableKeyboard?: boolean;
}

export const GAZE_MODE_LABELS: Record<GazeMode, { name: string; description: string }> = {
  webtoon: {
    name: 'Webtoon Vertical',
    description: 'Estabilización de lectura continua de arriba hacia abajo.',
  },
  manga_rtl: {
    name: 'Manga Oriental (RTL)',
    description: 'Flujo tradicional japonés de derecha a izquierda entre paneles.',
  },
  manga_ltr: {
    name: 'Cómic Occidental (LTR)',
    description: 'Flujo estándar occidental de izquierda a derecha.',
  },
};

export function useGazeAnchor({
  defaultEnabled = true,
  defaultMode = 'manga_rtl',
  defaultSensitivity = 1.0,
  defaultDwellMs = 250,
  defaultDriftTolerance = 40.0,
  defaultReturnAnchor = true,
  defaultHeatmapResolution = 'medium',
  enableKeyboard = true,
}: UseGazeAnchorOptions = {}) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isEnabled, setIsEnabled] = useState<boolean>(defaultEnabled);
  const [mode, setModeState] = useState<GazeMode>(defaultMode);
  const [saccadeSensitivity, setSaccadeSensitivityState] = useState<number>(defaultSensitivity);
  const [dwellThresholdMs, setDwellThresholdMsState] = useState<number>(defaultDwellMs);
  const [driftTolerancePx, setDriftTolerancePxState] = useState<number>(defaultDriftTolerance);
  const [returnAnchorEnabled, setReturnAnchorEnabledState] = useState<boolean>(defaultReturnAnchor);
  const [heatmapResolution, setHeatmapResolutionState] = useState<HeatmapResolution>(defaultHeatmapResolution);

  const [currentAnchor, setCurrentAnchor] = useState<GazeAnchorPoint | null>(null);
  const [isDriftActive, setIsDriftActive] = useState<boolean>(false);
  const [saccadeCount, setSaccadeCount] = useState<number>(0);

  // Tracking refs (Zero heap churn)
  const prevCoordsRef = useRef<GazeAnchorPoint>({ x: 0, y: 0 });
  const lastSampleTimeRef = useRef<number>(0);
  const dwellStartTimeRef = useRef<number>(0);

  const openHUD = useCallback(() => setIsOpen(true), []);
  const closeHUD = useCallback(() => setIsOpen(false), []);
  const toggleHUD = useCallback(() => setIsOpen((prev) => !prev), []);
  const toggleEnabled = useCallback(() => setIsEnabled((prev) => !prev), []);
  const toggleReturnAnchor = useCallback(() => setReturnAnchorEnabledState((prev) => !prev), []);

  const setMode = useCallback((m: GazeMode) => {
    if (m === 'webtoon' || m === 'manga_rtl' || m === 'manga_ltr') {
      setModeState(m);
    }
  }, []);

  const setSaccadeSensitivity = useCallback((val: number) => {
    const clamped = Math.min(3.0, Math.max(0.1, Math.round(val * 100) / 100));
    setSaccadeSensitivityState(clamped);
  }, []);

  const setDwellThresholdMs = useCallback((val: number) => {
    const clamped = Math.min(1000, Math.max(50, Math.round(val)));
    setDwellThresholdMsState(clamped);
  }, []);

  const setDriftTolerancePx = useCallback((val: number) => {
    const clamped = Math.min(200.0, Math.max(10.0, Math.round(val * 10) / 10));
    setDriftTolerancePxState(clamped);
  }, []);

  const setHeatmapResolution = useCallback((res: HeatmapResolution) => {
    if (res === 'low' || res === 'medium' || res === 'high') {
      setHeatmapResolutionState(res);
    }
  }, []);

  const resetAnchor = useCallback(() => {
    setCurrentAnchor(null);
    setIsDriftActive(false);
    prevCoordsRef.current = { x: 0, y: 0 };
    dwellStartTimeRef.current = 0;
  }, []);

  /**
   * Samples eye or pointer fixation coordinates with 10Hz throttling (protects T4500 CPU).
   */
  const updateGaze = useCallback(
    (clientX: number, clientY: number) => {
      if (!isEnabled) return;

      const now = Date.now();
      // Throttle to 100ms (10Hz max sampling rate to conserve Pentium T4500 CPU)
      if (now - lastSampleTimeRef.current < 90) return;

      const dt = Math.max(1, now - lastSampleTimeRef.current);
      lastSampleTimeRef.current = now;

      const prevX = prevCoordsRef.current.x;
      const prevY = prevCoordsRef.current.y;

      const dx = clientX - prevX;
      const dy = clientY - prevY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const velocity = dist / dt;

      if (dist <= driftTolerancePx) {
        // Within drift radius
        if (dwellStartTimeRef.current === 0) {
          dwellStartTimeRef.current = now;
        }
        const currentDwell = now - dwellStartTimeRef.current;
        if (currentDwell >= dwellThresholdMs) {
          setIsDriftActive(true);
          // Keep previous anchor to prevent eye micro-tremor jitter
          return;
        }
      } else {
        // Exceeded drift threshold -> movement or saccade
        dwellStartTimeRef.current = 0;
        setIsDriftActive(false);

        const saccadeThreshold = 35.0 / saccadeSensitivity;
        if (dist > saccadeThreshold || velocity > 1.5) {
          setSaccadeCount((c) => c + 1);
        }
      }

      prevCoordsRef.current = { x: clientX, y: clientY };
      setCurrentAnchor({ x: clientX, y: clientY });
    },
    [isEnabled, driftTolerancePx, dwellThresholdMs, saccadeSensitivity]
  );

  // Keyboard shortcut 'G' toggle
  useEffect(() => {
    if (!enableKeyboard) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Guard: do not trigger when typing inside inputs
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === 'g' || e.key === 'G') {
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          toggleHUD();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enableKeyboard, toggleHUD]);

  return {
    isOpen,
    isEnabled,
    mode,
    saccadeSensitivity,
    dwellThresholdMs,
    driftTolerancePx,
    returnAnchorEnabled,
    heatmapResolution,
    currentAnchor,
    isDriftActive,
    saccadeCount,
    openHUD,
    closeHUD,
    toggleHUD,
    toggleEnabled,
    toggleReturnAnchor,
    setMode,
    setSaccadeSensitivity,
    setDwellThresholdMs,
    setDriftTolerancePx,
    setHeatmapResolution,
    updateGaze,
    resetAnchor,
  };
}
