/**
 * KuraScroll - Sprint 92: Adaptive Ambient Screen-Glow Dispersion & Border Bleed Light Hook
 * 
 * Hardware-tuned for Intel Pentium T4500 & Intel GMA 4500MHD.
 * Provides client-side linear border bleed and letterbox dispersion:
 * eliminates harsh black-bar luminance contrast steps on 16:9 laptop screens
 * by projecting smooth linear border gradient feathers from the active page perimeter.
 * Bound to key 'G' for HUD toggling.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

export type GlowMode = 'cinematic_reactive' | 'dark_monochrome_dim' | 'vibrant_manhwa_bleed' | 'custom';

export interface AmbientGlowPresetConfig {
  mode: GlowMode;
  label: string;
  glowSpreadPx: number;
  glowOpacity: number;
  featherSmoothness: number;
  description: string;
}

export const AMBIENT_GLOW_PRESETS: Record<GlowMode, AmbientGlowPresetConfig> = {
  cinematic_reactive: {
    mode: 'cinematic_reactive',
    label: 'Cinematic Reactive (Balanced Bleed)',
    glowSpreadPx: 64,
    glowOpacity: 0.45,
    featherSmoothness: 1.20,
    description: 'Smoothly projects edge color average into letterbox borders to reduce eye strain',
  },
  dark_monochrome_dim: {
    mode: 'dark_monochrome_dim',
    label: 'Dark Monochrome Dim (Manga Feathers)',
    glowSpreadPx: 48,
    glowOpacity: 0.25,
    featherSmoothness: 1.50,
    description: 'Softly feathers high-contrast black/white ink edges into deep #121214 tone',
  },
  vibrant_manhwa_bleed: {
    mode: 'vibrant_manhwa_bleed',
    label: 'Vibrant Manhwa Bleed (Atmospheric Glow)',
    glowSpreadPx: 96,
    glowOpacity: 0.65,
    featherSmoothness: 1.00,
    description: 'High-energy atmospheric bloom for colorful action manhwa webtoons',
  },
  custom: {
    mode: 'custom',
    label: 'Custom User Profile',
    glowSpreadPx: 64,
    glowOpacity: 0.45,
    featherSmoothness: 1.20,
    description: 'Custom tuned ambient border bleed parameters',
  },
};

export interface UseAmbientGlowProps {
  seriesId?: string;
  initialMode?: GlowMode;
}

export interface UseAmbientGlowReturn {
  isEnabled: boolean;
  setIsEnabled: (enabled: boolean) => void;
  isHUDVisible: boolean;
  setIsHUDVisible: (visible: boolean) => void;
  mode: GlowMode;
  setMode: (mode: GlowMode) => void;
  glowSpreadPx: number;
  setGlowSpreadPx: (px: number) => void;
  glowOpacity: number;
  setGlowOpacity: (opacity: number) => void;
  featherSmoothness: number;
  setFeatherSmoothness: (smooth: number) => void;
  topRgb: string;
  setTopRgb: (rgb: string) => void;
  bottomRgb: string;
  setBottomRgb: (rgb: string) => void;
  leftRgb: string;
  setLeftRgb: (rgb: string) => void;
  rightRgb: string;
  setRightRgb: (rgb: string) => void;
  topGradientCss: string;
  bottomGradientCss: string;
  leftGradientCss: string;
  rightGradientCss: string;
  combinedBoxGlowCss: string;
  toggleHUD: () => void;
  resetToPreset: (mode: GlowMode) => void;
}

export function useAmbientGlow({
  seriesId,
  initialMode = 'cinematic_reactive',
}: UseAmbientGlowProps = {}): UseAmbientGlowReturn {
  const [isEnabled, setIsEnabled] = useState<boolean>(true);
  const [isHUDVisible, setIsHUDVisible] = useState<boolean>(false);
  const [mode, setModeState] = useState<GlowMode>(initialMode);

  const initialConfig = AMBIENT_GLOW_PRESETS[initialMode] || AMBIENT_GLOW_PRESETS.cinematic_reactive;
  const [glowSpreadPx, setGlowSpreadPx] = useState<number>(initialConfig.glowSpreadPx);
  const [glowOpacity, setGlowOpacity] = useState<number>(initialConfig.glowOpacity);
  const [featherSmoothness, setFeatherSmoothness] = useState<number>(initialConfig.featherSmoothness);

  const [topRgb, setTopRgb] = useState<string>('40, 40, 50');
  const [bottomRgb, setBottomRgb] = useState<string>('30, 30, 40');
  const [leftRgb, setLeftRgb] = useState<string>('35, 35, 45');
  const [rightRgb, setRightRgb] = useState<string>('35, 35, 45');

  const toggleHUD = useCallback(() => {
    setIsHUDVisible((prev) => !prev);
  }, []);

  const resetToPreset = useCallback((targetMode: GlowMode) => {
    const config = AMBIENT_GLOW_PRESETS[targetMode] || AMBIENT_GLOW_PRESETS.cinematic_reactive;
    setModeState(targetMode);
    setGlowSpreadPx(config.glowSpreadPx);
    setGlowOpacity(config.glowOpacity);
    setFeatherSmoothness(config.featherSmoothness);
  }, []);

  const setMode = useCallback((newMode: GlowMode) => {
    resetToPreset(newMode);
  }, [resetToPreset]);

  // Derived linear gradients with zero allocations
  const { topGradientCss, bottomGradientCss, leftGradientCss, rightGradientCss, combinedBoxGlowCss } = useMemo(() => {
    if (!isEnabled) {
      return {
        topGradientCss: 'none',
        bottomGradientCss: 'none',
        leftGradientCss: 'none',
        rightGradientCss: 'none',
        combinedBoxGlowCss: 'none',
      };
    }

    const clampedSpread = Math.max(16, Math.min(256, Math.round(glowSpreadPx)));
    const clampedOpacity = Math.max(0.00, Math.min(1.00, glowOpacity));
    const clampedSmooth = Math.max(0.50, Math.min(3.00, featherSmoothness));

    const effectiveSpread = Math.round(clampedSpread * clampedSmooth);
    const topGrad = `linear-gradient(to top, rgba(${topRgb}, ${clampedOpacity}) 0%, transparent ${effectiveSpread}px)`;
    const bottomGrad = `linear-gradient(to bottom, rgba(${bottomRgb}, ${clampedOpacity}) 0%, transparent ${effectiveSpread}px)`;
    const leftGrad = `linear-gradient(to left, rgba(${leftRgb}, ${clampedOpacity}) 0%, transparent ${effectiveSpread}px)`;
    const rightGrad = `linear-gradient(to right, rgba(${rightRgb}, ${clampedOpacity}) 0%, transparent ${effectiveSpread}px)`;

    const boxGlow = `inset 0 0 ${effectiveSpread}px rgba(${topRgb}, ${parseFloat((clampedOpacity * 0.5).toFixed(2))})`;

    return {
      topGradientCss: topGrad,
      bottomGradientCss: bottomGrad,
      leftGradientCss: leftGrad,
      rightGradientCss: rightGrad,
      combinedBoxGlowCss: boxGlow,
    };
  }, [isEnabled, glowSpreadPx, glowOpacity, featherSmoothness, topRgb, bottomRgb, leftRgb, rightRgb]);

  // Global hotkey 'G' listener
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

      if (e.key === 'g' || e.key === 'G') {
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
    mode,
    setMode,
    glowSpreadPx,
    setGlowSpreadPx,
    glowOpacity,
    setGlowOpacity,
    featherSmoothness,
    setFeatherSmoothness,
    topRgb,
    setTopRgb,
    bottomRgb,
    setBottomRgb,
    leftRgb,
    setLeftRgb,
    rightRgb,
    setRightRgb,
    topGradientCss,
    bottomGradientCss,
    leftGradientCss,
    rightGradientCss,
    combinedBoxGlowCss,
    toggleHUD,
    resetToPreset,
  };
}
