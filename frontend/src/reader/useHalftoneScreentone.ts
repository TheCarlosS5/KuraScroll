/**
 * KuraScroll Dynamic Halftone Screentone & Vintage Paper Aging Hook
 * Sprint 77 - Manga Screentone & Tankōbon Aging Simulator
 *
 * Coordinates procedural dot matrix overlays, warm paper aging color matrices,
 * and keyboard shortcut 'H'.
 * Hardware-tuned for Intel Pentium T4500 & Intel GMA 4500MHD (0 blur, 0 CLS).
 */

import { useState, useCallback, useEffect, useMemo } from 'react';

export type HalftonePresetName = 'pristine' | 'shonen_90s' | 'tankobon_retro' | 'pulp_press' | 'custom';

export interface HalftoneConfig {
  presetName: HalftonePresetName;
  dotPitchLpi: number;
  dotAngleDeg: number;
  dotIntensity: number;
  paperAgePct: number;
  foxingIntensity: number;
  isEnabled: boolean;
}

export const PRESET_DEFAULTS: Record<HalftonePresetName, Omit<HalftoneConfig, 'presetName'>> = {
  pristine: {
    dotPitchLpi: 60,
    dotAngleDeg: 45.0,
    dotIntensity: 0.0,
    paperAgePct: 0.0,
    foxingIntensity: 0.0,
    isEnabled: false,
  },
  shonen_90s: {
    dotPitchLpi: 60,
    dotAngleDeg: 45.0,
    dotIntensity: 0.35,
    paperAgePct: 0.20,
    foxingIntensity: 0.05,
    isEnabled: true,
  },
  tankobon_retro: {
    dotPitchLpi: 85,
    dotAngleDeg: 45.0,
    dotIntensity: 0.45,
    paperAgePct: 0.35,
    foxingIntensity: 0.12,
    isEnabled: true,
  },
  pulp_press: {
    dotPitchLpi: 45,
    dotAngleDeg: 45.0,
    dotIntensity: 0.55,
    paperAgePct: 0.50,
    foxingIntensity: 0.25,
    isEnabled: true,
  },
  custom: {
    dotPitchLpi: 65,
    dotAngleDeg: 45.0,
    dotIntensity: 0.40,
    paperAgePct: 0.25,
    foxingIntensity: 0.10,
    isEnabled: true,
  },
};

export interface UseHalftoneScreentoneOptions {
  defaultPreset?: HalftonePresetName;
  defaultEnabled?: boolean;
  enableKeyboard?: boolean;
}

export function useHalftoneScreentone({
  defaultPreset = 'pristine',
  defaultEnabled = false,
  enableKeyboard = true,
}: UseHalftoneScreentoneOptions = {}) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [presetName, setPresetNameState] = useState<HalftonePresetName>(defaultPreset);

  const initial = PRESET_DEFAULTS[defaultPreset] || PRESET_DEFAULTS.pristine;
  const [isEnabled, setIsEnabled] = useState<boolean>(defaultEnabled || initial.isEnabled);
  const [dotPitchLpi, setDotPitchLpiState] = useState<number>(initial.dotPitchLpi);
  const [dotAngleDeg, setDotAngleDegState] = useState<number>(initial.dotAngleDeg);
  const [dotIntensity, setDotIntensityState] = useState<number>(initial.dotIntensity);
  const [paperAgePct, setPaperAgePctState] = useState<number>(initial.paperAgePct);
  const [foxingIntensity, setFoxingIntensityState] = useState<number>(initial.foxingIntensity);

  const openHUD = useCallback(() => setIsOpen(true), []);
  const closeHUD = useCallback(() => setIsOpen(false), []);
  const toggleHUD = useCallback(() => setIsOpen((prev) => !prev), []);
  const toggleEnabled = useCallback(() => setIsEnabled((prev) => !prev), []);

  const selectPreset = useCallback((preset: HalftonePresetName) => {
    setPresetNameState(preset);
    const cfg = PRESET_DEFAULTS[preset];
    if (cfg) {
      setDotPitchLpiState(cfg.dotPitchLpi);
      setDotAngleDegState(cfg.dotAngleDeg);
      setDotIntensityState(cfg.dotIntensity);
      setPaperAgePctState(cfg.paperAgePct);
      setFoxingIntensityState(cfg.foxingIntensity);
      setIsEnabled(cfg.isEnabled);
    }
  }, []);

  const setDotPitchLpi = useCallback((val: number) => {
    setDotPitchLpiState(Math.max(20, Math.min(150, val)));
    setPresetNameState('custom');
  }, []);

  const setDotAngleDeg = useCallback((val: number) => {
    setDotAngleDegState(Math.max(0, Math.min(90, val)));
    setPresetNameState('custom');
  }, []);

  const setDotIntensity = useCallback((val: number) => {
    setDotIntensityState(Math.max(0, Math.min(1, val)));
    setPresetNameState('custom');
  }, []);

  const setPaperAgePct = useCallback((val: number) => {
    setPaperAgePctState(Math.max(0, Math.min(1, val)));
    setPresetNameState('custom');
  }, []);

  const setFoxingIntensity = useCallback((val: number) => {
    setFoxingIntensityState(Math.max(0, Math.min(1, val)));
    setPresetNameState('custom');
  }, []);

  const resetToDefaults = useCallback(() => {
    selectPreset('pristine');
  }, [selectPreset]);

  // Keyboard shortcut listener ('H' to toggle HUD)
  useEffect(() => {
    if (!enableKeyboard) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
        return;
      }

      if (e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        toggleHUD();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enableKeyboard, toggleHUD]);

  // Derived CSS/SVG filter representation (zero server-side load, 60 FPS GMA 4500MHD compatible)
  const filterStyles = useMemo(() => {
    if (!isEnabled || (dotIntensity === 0 && paperAgePct === 0)) {
      return {
        filter: 'none',
        backgroundColor: '#ffffff',
        dotSizePx: 0,
        dotSpacingPx: 6.4,
        dotOpacity: 0,
      };
    }

    const dotSpacingPx = Math.round((96 / dotPitchLpi) * 4 * 100) / 100;
    const dotSizePx = Math.max(0.5, Math.round(dotSpacingPx * dotIntensity * 0.45 * 100) / 100);
    const dotOpacity = Math.round(dotIntensity * 0.85 * 100) / 100;

    const r = (1.0 - 0.05 * paperAgePct).toFixed(3);
    const g = (1.0 - 0.15 * paperAgePct).toFixed(3);
    const b = (1.0 - 0.35 * paperAgePct).toFixed(3);
    const rByte = Math.round(255 * parseFloat(r)).toString(16).padStart(2, '0');
    const gByte = Math.round(255 * parseFloat(g)).toString(16).padStart(2, '0');
    const bByte = Math.round(255 * parseFloat(b)).toString(16).padStart(2, '0');
    const paperBgColor = `#${rByte}${gByte}${bByte}`;

    return {
      filter: `sepia(${Math.round(paperAgePct * 40)}%) contrast(${Math.round(100 + dotIntensity * 15)}%)`,
      backgroundColor: paperBgColor,
      dotSizePx,
      dotSpacingPx,
      dotOpacity,
    };
  }, [isEnabled, dotPitchLpi, dotIntensity, paperAgePct]);

  return {
    isOpen,
    openHUD,
    closeHUD,
    toggleHUD,
    isEnabled,
    toggleEnabled,
    presetName,
    selectPreset,
    dotPitchLpi,
    setDotPitchLpi,
    dotAngleDeg,
    setDotAngleDeg,
    dotIntensity,
    setDotIntensity,
    paperAgePct,
    setPaperAgePct,
    foxingIntensity,
    setFoxingIntensity,
    resetToDefaults,
    filterStyles,
  };
}
