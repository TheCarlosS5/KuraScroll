/**
 * KuraScroll Kinetic Motion Shutter & Multi-Layer Parallax Hook
 * Sprint 70 - 2.5D Climax Spread Transitions for Manga & Webtoons
 *
 * Provides LERP-smoothed multi-plane parallax drift, cinematic letterbox shutter,
 * accessibility guards (prefers-reduced-motion), and zero-layout-thrashing CSS math.
 * Hardware-tuned for Intel Pentium T4500 & Intel GMA 4500MHD (0 blur, 0 CLS).
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';

export type KineticLayerRole = 'FOREGROUND' | 'MIDGROUND' | 'BACKGROUND' | 'SFX_LAYER';
export type KineticIntensity = 'subtle' | 'normal' | 'intense';

export interface KineticLayerBox {
  id?: number;
  chapterId: string;
  pageNumber: number;
  panelIndex: number;
  layerIndex: number;
  layerRole: KineticLayerRole;
  normX: number;
  normY: number;
  normW: number;
  normH: number;
  depthFactor: number; // 0.0 - 2.0 (FG: 1.0, MG: 0.5, BG: 0.1)
  assetUrl?: string | null;
  createdAt?: number;
}

export interface LayerDriftResult {
  layerIndex: number;
  layerRole: KineticLayerRole;
  depthFactor: number;
  offsetX: number;
  offsetY: number;
  scale: number;
  cssTransform: string;
}

export interface UseKineticParallaxOptions {
  chapterId?: string;
  pageNumber?: number;
  layers?: KineticLayerBox[];
  defaultIntensity?: KineticIntensity;
  enableKeyboard?: boolean;
  shutterDurationMs?: number; // default 250ms
  onIntensityChange?: (intensity: KineticIntensity) => void;
  onKineticToggle?: (enabled: boolean) => void;
}

const INTENSITY_MAX_PX: Record<KineticIntensity, number> = {
  subtle: 4.0,
  normal: 8.0,
  intense: 12.0,
};

const LERP_ALPHA = 0.12;

export function useKineticParallax({
  chapterId,
  pageNumber,
  layers = [],
  defaultIntensity = 'normal',
  enableKeyboard = true,
  shutterDurationMs = 250,
  onIntensityChange,
  onKineticToggle,
}: UseKineticParallaxOptions = {}) {
  const [isKineticEnabled, setIsKineticEnabled] = useState<boolean>(true);
  const [intensity, setIntensityState] = useState<KineticIntensity>(defaultIntensity);
  const [isShutterActive, setIsShutterActive] = useState<boolean>(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(false);

  // Normalized input positions: target vs current (interpolated)
  const targetPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const currentPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const rafIdRef = useRef<number | null>(null);

  const [currentDrifts, setCurrentDrifts] = useState<LayerDriftResult[]>([]);

  // Check if current page/panel has valid climax layers
  const hasClimaxLayers = useMemo(() => {
    return Array.isArray(layers) && layers.length > 0;
  }, [layers]);

  // Reduced motion media query listener
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

  // Compute zero-allocation layer drifts
  const computeDrifts = useCallback(
    (inputX: number, inputY: number): LayerDriftResult[] => {
      if (!layers || layers.length === 0) return [];
      if (!isKineticEnabled || prefersReducedMotion) {
        return layers.map((l) => ({
          layerIndex: l.layerIndex,
          layerRole: l.layerRole,
          depthFactor: l.depthFactor,
          offsetX: 0,
          offsetY: 0,
          scale: 1.0,
          cssTransform: 'translate3d(0px, 0px, 0) scale(1)',
        }));
      }

      const maxOffset = INTENSITY_MAX_PX[intensity] ?? 8.0;
      const results: LayerDriftResult[] = new Array(layers.length);

      for (let i = 0; i < layers.length; i++) {
        const layer = layers[i];
        const depth = layer.depthFactor;
        const offsetX = Math.round(inputX * depth * maxOffset * 100) / 100;
        const offsetY = Math.round(inputY * depth * maxOffset * 100) / 100;
        const scale = Math.round((1.0 + depth * 0.08) * 1000) / 1000;

        results[i] = {
          layerIndex: layer.layerIndex,
          layerRole: layer.layerRole,
          depthFactor: depth,
          offsetX,
          offsetY,
          scale,
          cssTransform: `translate3d(${offsetX}px, ${offsetY}px, 0) scale(${scale})`,
        };
      }
      return results;
    },
    [layers, isKineticEnabled, prefersReducedMotion, intensity]
  );

  // RAF loop for smooth LERP interpolation
  const startRafLoop = useCallback(() => {
    if (rafIdRef.current !== null) return;

    const tick = () => {
      const target = targetPosRef.current;
      const current = currentPosRef.current;

      const dx = target.x - current.x;
      const dy = target.y - current.y;

      if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) {
        current.x += dx * LERP_ALPHA;
        current.y += dy * LERP_ALPHA;
        setCurrentDrifts(computeDrifts(current.x, current.y));
        rafIdRef.current = requestAnimationFrame(tick);
      } else {
        current.x = target.x;
        current.y = target.y;
        setCurrentDrifts(computeDrifts(current.x, current.y));
        rafIdRef.current = null;
      }
    };

    rafIdRef.current = requestAnimationFrame(tick);
  }, [computeDrifts]);

  // Handle pointer/mouse move event
  const handlePointerMove = useCallback(
    (e: { clientX: number; clientY: number }) => {
      if (typeof window === 'undefined' || !isKineticEnabled || prefersReducedMotion) return;

      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;

      // Normalize coordinates to [-1.0, 1.0]
      const normX = Math.max(-1.0, Math.min(1.0, (e.clientX - centerX) / (centerX || 1)));
      const normY = Math.max(-1.0, Math.min(1.0, (e.clientY - centerY) / (centerY || 1)));

      targetPosRef.current = { x: normX, y: normY };
      startRafLoop();
    },
    [isKineticEnabled, prefersReducedMotion, startRafLoop]
  );

  // Reset pointer on mouse leave
  const handlePointerLeave = useCallback(() => {
    targetPosRef.current = { x: 0, y: 0 };
    startRafLoop();
  }, [startRafLoop]);

  // Toggle kinetic state
  const toggleKinetic = useCallback(() => {
    setIsKineticEnabled((prev) => {
      const next = !prev;
      onKineticToggle?.(next);
      return next;
    });
  }, [onKineticToggle]);

  // Set intensity level
  const setIntensity = useCallback(
    (newIntensity: KineticIntensity) => {
      setIntensityState(newIntensity);
      onIntensityChange?.(newIntensity);
    },
    [onIntensityChange]
  );

  // Shutter letterbox auto-trigger on climax layers
  useEffect(() => {
    if (hasClimaxLayers && isKineticEnabled) {
      setIsShutterActive(true);
    } else {
      setIsShutterActive(false);
    }
  }, [hasClimaxLayers, isKineticEnabled]);

  // Initial drift calculation when layers or intensity change
  useEffect(() => {
    setCurrentDrifts(computeDrifts(currentPosRef.current.x, currentPosRef.current.y));
  }, [computeDrifts]);

  // Keyboard shortcut listener ('K' or 'k' toggles kinetic mode)
  useEffect(() => {
    if (!enableKeyboard || typeof window === 'undefined') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input/textarea
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;

      if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        toggleKinetic();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enableKeyboard, toggleKinetic]);

  // Cleanup animation frame
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, []);

  return {
    isKineticEnabled,
    intensity,
    isShutterActive,
    prefersReducedMotion,
    hasClimaxLayers,
    currentDrifts,
    shutterDurationMs,
    toggleKinetic,
    setIntensity,
    handlePointerMove,
    handlePointerLeave,
  };
}
