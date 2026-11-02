/**
 * KuraScroll Dynamic Optical Reading Ruler & Saccadic Guided Focus Hook
 * Sprint 71 - Optical Focus & Accessibility Assistance for Manga & Webtoons
 *
 * Provides pointer tracking, saccadic flow pacing, aperture geometry calculation,
 * and WCAG 2.2 accessibility guards (prefers-reduced-motion, keyboard alternatives).
 * Hardware-tuned for Intel Pentium T4500 & Intel GMA 4500MHD (0 blur, 0 CLS, zero-alloc).
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';

export type OpticalTint = 'amber' | 'mint' | 'rose' | 'neutral' | 'midnight';
export type RulerMode = 'ruler' | 'shutter' | 'saccadic_pacer';
export type RulerOrientation = 'horizontal' | 'vertical';

export interface UseReadingRulerOptions {
  userId?: string;
  defaultEnabled?: boolean;
  defaultMode?: RulerMode;
  defaultOrientation?: RulerOrientation;
  defaultSlotSize?: number;
  defaultDimOpacity?: number;
  defaultTint?: OpticalTint;
  defaultSpeedWpm?: number;
  enableKeyboard?: boolean;
  onPreferencesChange?: (prefs: any) => void;
}

export const TINT_HEX_MAP: Record<OpticalTint, string> = {
  amber: '#ffb74d',
  mint: '#81c784',
  rose: '#f48fb1',
  neutral: '#e0e0e0',
  midnight: '#90caf9',
};

export function useReadingRuler({
  userId = 'default_user',
  defaultEnabled = false,
  defaultMode = 'ruler',
  defaultOrientation = 'horizontal',
  defaultSlotSize = 64,
  defaultDimOpacity = 0.50,
  defaultTint = 'amber',
  defaultSpeedWpm = 250,
  enableKeyboard = true,
  onPreferencesChange,
}: UseReadingRulerOptions = {}) {
  const [isEnabled, setIsEnabled] = useState<boolean>(defaultEnabled);
  const [mode, setMode] = useState<RulerMode>(defaultMode);
  const [orientation, setOrientation] = useState<RulerOrientation>(defaultOrientation);
  const [slotSize, setSlotSize] = useState<number>(defaultSlotSize);
  const [dimOpacity, setDimOpacity] = useState<number>(defaultDimOpacity);
  const [tintColor, setTintColor] = useState<OpticalTint>(defaultTint);
  const [pacerSpeedWpm, setPacerSpeedWpm] = useState<number>(defaultSpeedWpm);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [centerCoord, setCenterCoord] = useState<number>(200);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(false);

  // Hot path mutable primitives to prevent object allocation
  const targetCoordRef = useRef<number>(200);
  const currentCoordRef = useRef<number>(200);
  const lastTimeRef = useRef<number>(0);
  const rafIdRef = useRef<number | null>(null);

  // Check prefers-reduced-motion media query
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    } else if ((mediaQuery as any).addListener) {
      (mediaQuery as any).addListener(handler);
      return () => (mediaQuery as any).removeListener(handler);
    }
  }, []);

  // Compute zero-allocation geometry
  const geometry = useMemo(() => {
    const limit = typeof window !== 'undefined'
      ? (orientation === 'horizontal' ? window.innerHeight : window.innerWidth)
      : 1080;

    const clampedCenter = Math.max(0, Math.min(limit, Math.round(centerCoord)));
    const clampedSlot = Math.max(32, Math.min(240, Math.round(slotSize)));
    const halfSlot = Math.round(clampedSlot / 2);

    const apertureStart = Math.max(0, clampedCenter - halfSlot);
    const apertureEnd = Math.min(limit, clampedCenter + halfSlot);
    const shutterBeforeSize = apertureStart;
    const shutterAfterSize = Math.max(0, limit - apertureEnd);
    const hex = TINT_HEX_MAP[tintColor] || '#ffb74d';

    return {
      orientation,
      centerCoord: clampedCenter,
      slotSize: clampedSlot,
      apertureStart,
      apertureEnd,
      shutterBeforeSize,
      shutterAfterSize,
      dimOpacity,
      tintColor,
      cssVars: {
        '--ruler-aperture-start': `${apertureStart}px`,
        '--ruler-aperture-end': `${apertureEnd}px`,
        '--ruler-slot-size': `${clampedSlot}px`,
        '--ruler-shutter-before': `${shutterBeforeSize}px`,
        '--ruler-shutter-after': `${shutterAfterSize}px`,
        '--ruler-dim-opacity': `${dimOpacity}`,
        '--ruler-tint-color': hex,
      },
    };
  }, [orientation, centerCoord, slotSize, dimOpacity, tintColor]);

  // Pointer move handler (zero allocation: mutates primitive ref)
  const handlePointerMove = useCallback((e: { clientX: number; clientY: number }) => {
    if (!isEnabled) return;
    const pos = orientation === 'horizontal' ? e.clientY : e.clientX;
    targetCoordRef.current = pos;
    currentCoordRef.current = pos;
    setCenterCoord(pos);
  }, [isEnabled, orientation]);

  // Step discrete positions (e.g. arrow keys)
  const stepRuler = useCallback((deltaPx: number) => {
    setCenterCoord((prev) => {
      const limit = typeof window !== 'undefined'
        ? (orientation === 'horizontal' ? window.innerHeight : window.innerWidth)
        : 1080;
      const next = Math.max(0, Math.min(limit, prev + deltaPx));
      targetCoordRef.current = next;
      currentCoordRef.current = next;
      return next;
    });
  }, [orientation]);

  // Toggle ruler visibility
  const toggleVisibility = useCallback(() => {
    setIsEnabled((prev) => !prev);
  }, []);

  // Toggle pause/play
  const togglePause = useCallback(() => {
    setIsPaused((prev) => !prev);
  }, []);

  // Saccadic Pacer RAF animation loop
  useEffect(() => {
    if (!isEnabled || mode !== 'saccadic_pacer' || isPaused || prefersReducedMotion) {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      return;
    }

    lastTimeRef.current = performance.now();

    const loop = (time: number) => {
      const dt = (time - lastTimeRef.current) / 1000;
      lastTimeRef.current = time;

      // Translate WPM to pixels per second: ~250 WPM ≈ 35 px/sec
      const pxPerSec = (pacerSpeedWpm / 250) * 35;
      const delta = pxPerSec * dt;

      const limit = typeof window !== 'undefined'
        ? (orientation === 'horizontal' ? window.innerHeight : window.innerWidth)
        : 1080;

      let next = currentCoordRef.current + delta;
      if (next > limit) {
        next = 0; // wrap to top
      }

      currentCoordRef.current = next;
      targetCoordRef.current = next;
      setCenterCoord(next);

      rafIdRef.current = requestAnimationFrame(loop);
    };

    rafIdRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [isEnabled, mode, isPaused, prefersReducedMotion, pacerSpeedWpm, orientation]);

  // Global keyboard shortcuts: 'U' toggles visibility, Space pauses pacer, Up/Down steps
  useEffect(() => {
    if (!enableKeyboard || typeof window === 'undefined') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;

      if (e.key === 'u' || e.key === 'U') {
        e.preventDefault();
        toggleVisibility();
      } else if (isEnabled && (e.key === ' ' || e.code === 'Space') && mode === 'saccadic_pacer') {
        e.preventDefault();
        togglePause();
      } else if (isEnabled && (e.key === 'ArrowUp' || e.key === 'ArrowLeft')) {
        e.preventDefault();
        stepRuler(-24);
      } else if (isEnabled && (e.key === 'ArrowDown' || e.key === 'ArrowRight')) {
        e.preventDefault();
        stepRuler(24);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enableKeyboard, isEnabled, mode, toggleVisibility, togglePause, stepRuler]);

  return {
    isEnabled,
    mode,
    orientation,
    slotSize,
    dimOpacity,
    tintColor,
    pacerSpeedWpm,
    isPaused,
    centerCoord,
    geometry,
    prefersReducedMotion,
    setIsEnabled,
    setMode,
    setOrientation,
    setSlotSize,
    setDimOpacity,
    setTintColor,
    setPacerSpeedWpm,
    toggleVisibility,
    togglePause,
    stepRuler,
    handlePointerMove,
  };
}
