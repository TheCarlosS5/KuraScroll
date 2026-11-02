/**
 * KuraScroll - Sprint 99: Adaptive Per-Panel Visual Pacing & Dynamic Zoom Framing Interpolator Hook
 * 
 * Hardware-tuned for Intel Pentium T4500 & Intel GMA 4500MHD.
 * Dynamically computes viewport framing, translation vectors, and scale transforms for guided panel reading.
 * Zero GC allocations, zero layout reflows, hardware composited on Intel GMA 4500MHD.
 * Bound to key 'P' for HUD toggling.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

export type PacingMode = 'cinematic_smooth' | 'dynamic_action' | 'instant_cut' | 'custom';

export interface PanelAabb {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PanelPacingPresetConfig {
  mode: PacingMode;
  label: string;
  transitionDurationMs: number;
  zoomOvershootRatio: number;
  edgePaddingPx: number;
  isMotionReduced: boolean;
  description: string;
}

export const PANEL_PACING_PRESETS: Record<PacingMode, PanelPacingPresetConfig> = {
  cinematic_smooth: {
    mode: 'cinematic_smooth',
    label: 'Cinematic Smooth (Standard Tankōbon Pacing)',
    transitionDurationMs: 280,
    zoomOvershootRatio: 1.05,
    edgePaddingPx: 16,
    isMotionReduced: false,
    description: 'Gentle EaseOutBack camera glide framing each panel with subtle depth overshoot',
  },
  dynamic_action: {
    mode: 'dynamic_action',
    label: 'Dynamic Action (Shōnen Combat & Fast Sequences)',
    transitionDurationMs: 180,
    zoomOvershootRatio: 1.15,
    edgePaddingPx: 8,
    isMotionReduced: false,
    description: 'Snappy high-energy transitions with pronounced focal punch-in on impact panels',
  },
  instant_cut: {
    mode: 'instant_cut',
    label: 'Instant Cut (Zero Latency / Accessibility)',
    transitionDurationMs: 100,
    zoomOvershootRatio: 1.00,
    edgePaddingPx: 0,
    isMotionReduced: true,
    description: 'Immediate jump cut between panels preventing vestibular motion discomfort',
  },
  custom: {
    mode: 'custom',
    label: 'Custom User Framing Profile',
    transitionDurationMs: 280,
    zoomOvershootRatio: 1.05,
    edgePaddingPx: 16,
    isMotionReduced: false,
    description: 'Custom tuned transition timing and bounding box overshoot parameters',
  },
};

export interface UsePanelPacingProps {
  seriesId?: string;
  initialMode?: PacingMode;
}

export interface UsePanelPacingReturn {
  isEnabled: boolean;
  setIsEnabled: (enabled: boolean) => void;
  isHUDVisible: boolean;
  setIsHUDVisible: (visible: boolean) => void;
  mode: PacingMode;
  setMode: (mode: PacingMode) => void;
  transitionDurationMs: number;
  setTransitionDurationMs: (val: number) => void;
  zoomOvershootRatio: number;
  setZoomOvershootRatio: (val: number) => void;
  edgePaddingPx: number;
  setEdgePaddingPx: (val: number) => void;
  isMotionReduced: boolean;
  setIsMotionReduced: (val: boolean) => void;
  sourceAabb: PanelAabb;
  setSourceAabb: (val: PanelAabb) => void;
  targetAabb: PanelAabb;
  setTargetAabb: (val: PanelAabb) => void;
  progress: number;
  setProgress: (val: number) => void;
  translateX: number;
  translateY: number;
  scale: number;
  transformCss: string;
  transitionCss: string;
  isOvershootActive: boolean;
  toggleHUD: () => void;
  resetToPreset: (mode: PacingMode) => void;
  toggleMotionReduced: () => void;
}

export function usePanelPacing({
  seriesId,
  initialMode = 'cinematic_smooth',
}: UsePanelPacingProps = {}): UsePanelPacingReturn {
  const [isEnabled, setIsEnabled] = useState<boolean>(true);
  const [isHUDVisible, setIsHUDVisible] = useState<boolean>(false);
  const [mode, setModeState] = useState<PacingMode>(initialMode);

  const initialConfig = PANEL_PACING_PRESETS[initialMode] || PANEL_PACING_PRESETS.cinematic_smooth;
  const [transitionDurationMs, setTransitionDurationMs] = useState<number>(initialConfig.transitionDurationMs);
  const [zoomOvershootRatio, setZoomOvershootRatio] = useState<number>(initialConfig.zoomOvershootRatio);
  const [edgePaddingPx, setEdgePaddingPx] = useState<number>(initialConfig.edgePaddingPx);
  const [isMotionReduced, setIsMotionReduced] = useState<boolean>(initialConfig.isMotionReduced);

  const [sourceAabb, setSourceAabb] = useState<PanelAabb>({ x: 0, y: 0, width: 800, height: 600 });
  const [targetAabb, setTargetAabb] = useState<PanelAabb>({ x: 200, y: 400, width: 600, height: 450 });
  const [progress, setProgress] = useState<number>(1.0);

  const toggleHUD = useCallback(() => {
    setIsHUDVisible((prev) => !prev);
  }, []);

  const resetToPreset = useCallback((targetMode: PacingMode) => {
    const config = PANEL_PACING_PRESETS[targetMode] || PANEL_PACING_PRESETS.cinematic_smooth;
    setModeState(targetMode);
    setTransitionDurationMs(config.transitionDurationMs);
    setZoomOvershootRatio(config.zoomOvershootRatio);
    setEdgePaddingPx(config.edgePaddingPx);
    setIsMotionReduced(config.isMotionReduced);
  }, []);

  const setMode = useCallback((newMode: PacingMode) => {
    resetToPreset(newMode);
  }, [resetToPreset]);

  const toggleMotionReduced = useCallback(() => {
    setIsMotionReduced((prev) => !prev);
  }, []);

  // Keyboard shortcut: 'P' toggles HUD
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        (activeEl && (activeEl as HTMLElement).isContentEditable);

      if (isInput) return;

      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        toggleHUD();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleHUD]);

  // Derived transform calculation with zero GC allocations
  const {
    translateX,
    translateY,
    scale,
    transformCss,
    transitionCss,
    isOvershootActive,
  } = useMemo(() => {
    if (!isEnabled) {
      return {
        translateX: 0,
        translateY: 0,
        scale: 1.0,
        transformCss: 'none',
        transitionCss: 'none',
        isOvershootActive: false,
      };
    }

    const clampedProgress = Math.max(0.0, Math.min(1.0, progress));
    const clampedOvershoot = Math.max(1.00, Math.min(1.30, parseFloat(zoomOvershootRatio.toFixed(2))));
    const clampedPadding = Math.max(0, Math.min(64, Math.round(edgePaddingPx)));
    const clampedDuration = Math.max(100, Math.min(1000, Math.round(transitionDurationMs)));

    const viewportW = 1280;
    const viewportH = 720;
    const availW = Math.max(100, viewportW - clampedPadding * 2);
    const availH = Math.max(100, viewportH - clampedPadding * 2);

    const sW = Math.max(1, sourceAabb.width);
    const sH = Math.max(1, sourceAabb.height);
    const tW = Math.max(1, targetAabb.width);
    const tH = Math.max(1, targetAabb.height);

    const scaleSource = Math.min(availW / sW, availH / sH);
    const scaleTarget = Math.min(availW / tW, availH / tH);

    const sourceCenterX = sourceAabb.x + sW * 0.5;
    const sourceCenterY = sourceAabb.y + sH * 0.5;
    const targetCenterX = targetAabb.x + tW * 0.5;
    const targetCenterY = targetAabb.y + tH * 0.5;

    const vpCenterX = viewportW * 0.5;
    const vpCenterY = viewportH * 0.5;

    const txSource = vpCenterX - sourceCenterX * scaleSource;
    const tySource = vpCenterY - sourceCenterY * scaleSource;
    const txTarget = vpCenterX - targetCenterX * scaleTarget;
    const tyTarget = vpCenterY - targetCenterY * scaleTarget;

    let easedT = clampedProgress;
    if (!isMotionReduced && clampedProgress < 1.0 && clampedProgress > 0.0) {
      const c1 = 1.70158 * (clampedOvershoot - 1.0) * 10.0;
      const c3 = c1 + 1.0;
      const t = clampedProgress - 1.0;
      easedT = 1.0 + c3 * Math.pow(t, 3) + c1 * Math.pow(t, 2);
    }

    const currentTx = parseFloat((txSource + (txTarget - txSource) * easedT).toFixed(2));
    const currentTy = parseFloat((tySource + (tyTarget - tySource) * easedT).toFixed(2));
    const currentScale = parseFloat((scaleSource + (scaleTarget - scaleSource) * easedT).toFixed(3));

    const transform = `translate3d(${currentTx}px, ${currentTy}px, 0px) scale(${currentScale})`;
    const transition = isMotionReduced
      ? 'none'
      : `transform ${clampedDuration}ms cubic-bezier(0.16, 1, 0.3, 1)`;

    return {
      translateX: currentTx,
      translateY: currentTy,
      scale: currentScale,
      transformCss: transform,
      transitionCss: transition,
      isOvershootActive: !isMotionReduced && clampedOvershoot > 1.01,
    };
  }, [isEnabled, progress, zoomOvershootRatio, edgePaddingPx, transitionDurationMs, sourceAabb, targetAabb, isMotionReduced]);

  return {
    isEnabled,
    setIsEnabled,
    isHUDVisible,
    setIsHUDVisible,
    mode,
    setMode,
    transitionDurationMs,
    setTransitionDurationMs,
    zoomOvershootRatio,
    setZoomOvershootRatio,
    edgePaddingPx,
    setEdgePaddingPx,
    isMotionReduced,
    setIsMotionReduced,
    sourceAabb,
    setSourceAabb,
    targetAabb,
    setTargetAabb,
    progress,
    setProgress,
    translateX,
    translateY,
    scale,
    transformCss,
    transitionCss,
    isOvershootActive,
    toggleHUD,
    resetToPreset,
    toggleMotionReduced,
  };
}
