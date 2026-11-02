/**
 * KuraScroll - Sprint 96: Bi-Directional Dual-Page Gutters & Crease Shadow Synthesizer Hook
 * 
 * Hardware-tuned for Intel Pentium T4500 & Intel GMA 4500MHD.
 * Provides client-side bilateral spine crease shadow gradients and asymmetric page block thickness modulation.
 * Bound to key 'C' for HUD toggling.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

export type SpreadBindingMode = 'tankobon_tight' | 'magazine_wide' | 'flat_lay' | 'custom';

export interface CreaseShadowPresetConfig {
  mode: SpreadBindingMode;
  label: string;
  spineShadowIntensity: number;
  gutterWidthPx: number;
  asymmetryRatio: number;
  description: string;
}

export const CREASE_SHADOW_PRESETS: Record<SpreadBindingMode, CreaseShadowPresetConfig> = {
  tankobon_tight: {
    mode: 'tankobon_tight',
    label: 'Tankōbon Tight Binding (Standard B6)',
    spineShadowIntensity: 0.65,
    gutterWidthPx: 24,
    asymmetryRatio: 0.50,
    description: 'Deep, dramatic crease shadow with prominent inner gutter for standard manga paperbacks',
  },
  magazine_wide: {
    mode: 'magazine_wide',
    label: 'Magazine Wide Spread (Weekly Shōnen)',
    spineShadowIntensity: 0.40,
    gutterWidthPx: 36,
    asymmetryRatio: 0.50,
    description: 'Flatter central spine with soft, expansive shadow falloff for telephone-book magazines',
  },
  flat_lay: {
    mode: 'flat_lay',
    label: 'Flat-Lay Perfect Binding (Collector Hardcover)',
    spineShadowIntensity: 0.20,
    gutterWidthPx: 12,
    asymmetryRatio: 0.50,
    description: 'Subtle crease shadow for premium lay-flat deluxe editions and artbooks',
  },
  custom: {
    mode: 'custom',
    label: 'Custom User Spine Profile',
    spineShadowIntensity: 0.65,
    gutterWidthPx: 24,
    asymmetryRatio: 0.50,
    description: 'Custom tuned spine crease shadow and gutter parameters',
  },
};

export interface UseCreaseShadowProps {
  seriesId?: string;
  initialMode?: SpreadBindingMode;
  initialRtl?: boolean;
}

export interface UseCreaseShadowReturn {
  isEnabled: boolean;
  setIsEnabled: (enabled: boolean) => void;
  isHUDVisible: boolean;
  setIsHUDVisible: (visible: boolean) => void;
  mode: SpreadBindingMode;
  setMode: (mode: SpreadBindingMode) => void;
  spineShadowIntensity: number;
  setSpineShadowIntensity: (val: number) => void;
  gutterWidthPx: number;
  setGutterWidthPx: (px: number) => void;
  asymmetryRatio: number;
  setAsymmetryRatio: (val: number) => void;
  isRtl: boolean;
  setIsRtl: (rtl: boolean) => void;
  progressRatio: number;
  setProgressRatio: (ratio: number) => void;
  leftGutterWidthPx: number;
  rightGutterWidthPx: number;
  leftShadowOpacity: number;
  rightShadowOpacity: number;
  leftPageShadowCss: string;
  rightPageShadowCss: string;
  spineCurvatureTransformCss: string;
  effectiveAsymmetry: number;
  toggleHUD: () => void;
  resetToPreset: (mode: SpreadBindingMode) => void;
  toggleRtl: () => void;
}

export function useCreaseShadow({
  seriesId,
  initialMode = 'tankobon_tight',
  initialRtl = true,
}: UseCreaseShadowProps = {}): UseCreaseShadowReturn {
  const [isEnabled, setIsEnabled] = useState<boolean>(true);
  const [isHUDVisible, setIsHUDVisible] = useState<boolean>(false);
  const [mode, setModeState] = useState<SpreadBindingMode>(initialMode);

  const initialConfig = CREASE_SHADOW_PRESETS[initialMode] || CREASE_SHADOW_PRESETS.tankobon_tight;
  const [spineShadowIntensity, setSpineShadowIntensity] = useState<number>(initialConfig.spineShadowIntensity);
  const [gutterWidthPx, setGutterWidthPx] = useState<number>(initialConfig.gutterWidthPx);
  const [asymmetryRatio, setAsymmetryRatio] = useState<number>(initialConfig.asymmetryRatio);
  const [isRtl, setIsRtl] = useState<boolean>(initialRtl);
  const [progressRatio, setProgressRatio] = useState<number>(0.50); // Default to midpoint

  const toggleHUD = useCallback(() => {
    setIsHUDVisible((prev) => !prev);
  }, []);

  const resetToPreset = useCallback((targetMode: SpreadBindingMode) => {
    const config = CREASE_SHADOW_PRESETS[targetMode] || CREASE_SHADOW_PRESETS.tankobon_tight;
    setModeState(targetMode);
    setSpineShadowIntensity(config.spineShadowIntensity);
    setGutterWidthPx(config.gutterWidthPx);
    setAsymmetryRatio(config.asymmetryRatio);
  }, []);

  const setMode = useCallback((newMode: SpreadBindingMode) => {
    resetToPreset(newMode);
  }, [resetToPreset]);

  const toggleRtl = useCallback(() => {
    setIsRtl((prev) => !prev);
  }, []);

  // Keyboard shortcut: 'C' toggles HUD
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        (activeEl && (activeEl as HTMLElement).isContentEditable);

      if (isInput) return;

      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        toggleHUD();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleHUD]);

  // Derived bilateral spine crease shadow calculation with zero allocations
  const {
    leftGutterWidthPx,
    rightGutterWidthPx,
    leftShadowOpacity,
    rightShadowOpacity,
    leftPageShadowCss,
    rightPageShadowCss,
    spineCurvatureTransformCss,
    effectiveAsymmetry,
  } = useMemo(() => {
    if (!isEnabled) {
      return {
        leftGutterWidthPx: 0,
        rightGutterWidthPx: 0,
        leftShadowOpacity: 0,
        rightShadowOpacity: 0,
        leftPageShadowCss: 'none',
        rightPageShadowCss: 'none',
        spineCurvatureTransformCss: 'none',
        effectiveAsymmetry: 0,
      };
    }

    const clampedProgress = Math.max(0.00, Math.min(1.00, progressRatio));
    const clampedIntensity = Math.max(0.00, Math.min(1.00, spineShadowIntensity));
    const clampedGutterWidth = Math.max(8, Math.min(64, gutterWidthPx));
    const clampedAsymmetry = Math.max(0.00, Math.min(1.00, asymmetryRatio));

    const normalizedProgress = isRtl ? (1.0 - clampedProgress) : clampedProgress;
    const progressShift = (normalizedProgress - 0.5) * 2.0 * clampedAsymmetry;

    const leftWeight = Math.max(0.3, Math.min(1.7, 1.0 + progressShift));
    const rightWeight = Math.max(0.3, Math.min(1.7, 1.0 - progressShift));

    const leftGutter = Math.round(clampedGutterWidth * leftWeight * 0.5);
    const rightGutter = Math.round(clampedGutterWidth * rightWeight * 0.5);

    const leftOpacity = parseFloat((clampedIntensity * leftWeight * 0.55).toFixed(2));
    const rightOpacity = parseFloat((clampedIntensity * rightWeight * 0.55).toFixed(2));

    const leftCss = leftOpacity > 0.01
      ? `linear-gradient(to left, rgba(0, 0, 0, ${leftOpacity}) 0%, transparent ${leftGutter}px)`
      : 'none';

    const rightCss = rightOpacity > 0.01
      ? `linear-gradient(to right, rgba(0, 0, 0, ${rightOpacity}) 0%, transparent ${rightGutter}px)`
      : 'none';

    const skewDeg = parseFloat((progressShift * 1.2).toFixed(2));
    const transformCss = `perspective(800px) skewY(${skewDeg}deg)`;

    return {
      leftGutterWidthPx: leftGutter,
      rightGutterWidthPx: rightGutter,
      leftShadowOpacity: leftOpacity,
      rightShadowOpacity: rightOpacity,
      leftPageShadowCss: leftCss,
      rightPageShadowCss: rightCss,
      spineCurvatureTransformCss: transformCss,
      effectiveAsymmetry: parseFloat(progressShift.toFixed(2)),
    };
  }, [isEnabled, progressRatio, spineShadowIntensity, gutterWidthPx, asymmetryRatio, isRtl]);

  return {
    isEnabled,
    setIsEnabled,
    isHUDVisible,
    setIsHUDVisible,
    mode,
    setMode,
    spineShadowIntensity,
    setSpineShadowIntensity,
    gutterWidthPx,
    setGutterWidthPx,
    asymmetryRatio,
    setAsymmetryRatio,
    isRtl,
    setIsRtl,
    progressRatio,
    setProgressRatio,
    leftGutterWidthPx,
    rightGutterWidthPx,
    leftShadowOpacity,
    rightShadowOpacity,
    leftPageShadowCss,
    rightPageShadowCss,
    spineCurvatureTransformCss,
    effectiveAsymmetry,
    toggleHUD,
    resetToPreset,
    toggleRtl,
  };
}
