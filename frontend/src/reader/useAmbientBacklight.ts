/**
 * KuraScroll Adaptive Ambient Lighting Reactive Backlight Hook
 * Sprint 80 - Dynamic Luminance Normalizer & Circadian Eye Shield
 *
 * Coordinates real-time color temperature adjustments (1800K - 6500K),
 * circadian solar scheduling, and keyboard shortcut 'L'.
 * Hardware-tuned for Intel Pentium T4500 & Intel GMA 4500MHD (0 blur, 0 CLS).
 */

import { useState, useCallback, useEffect, useMemo } from 'react';

export type PaperTintMode = 'neutral' | 'warm_amber' | 'sunset' | 'candlelight' | 'e_ink_amber' | 'custom';

export interface UseAmbientBacklightOptions {
  defaultEnabled?: boolean;
  defaultKelvin?: number;
  defaultLuminance?: number;
  defaultBlueLightReduction?: number;
  defaultPaperTintMode?: PaperTintMode;
  defaultCircadianAuto?: boolean;
  enableKeyboard?: boolean;
  hardwareTier?: 'standard' | 'low-spec';
}

export const BACKLIGHT_PRESETS: Record<PaperTintMode, {
  name: string;
  kelvin: number;
  luminance: number;
  blueLightReduction: number;
  description: string;
}> = {
  neutral: {
    name: 'Neutral (6500K)',
    kelvin: 6500,
    luminance: 1.0,
    blueLightReduction: 0.0,
    description: 'Luz día fría estándar con máximo contraste.',
  },
  warm_amber: {
    name: 'Cálido (4500K)',
    kelvin: 4500,
    luminance: 0.95,
    blueLightReduction: 0.25,
    description: 'Iluminación interior cálida para descanso ocular moderado.',
  },
  sunset: {
    name: 'Atardecer (3200K)',
    kelvin: 3200,
    luminance: 0.9,
    blueLightReduction: 0.45,
    description: 'Tono dorado vespertino que reduce el impacto de luz azul.',
  },
  candlelight: {
    name: 'Vela / Noche (2200K)',
    kelvin: 2200,
    luminance: 0.8,
    blueLightReduction: 0.65,
    description: 'Ámbar profundo para lectura nocturna en completa oscuridad.',
  },
  e_ink_amber: {
    name: 'E-Ink Ámbar (1900K)',
    kelvin: 1900,
    luminance: 0.75,
    blueLightReduction: 0.75,
    description: 'Modo monocromático de alta calidez emulando tinta electrónica.',
  },
  custom: {
    name: 'Personalizado',
    kelvin: 5000,
    luminance: 1.0,
    blueLightReduction: 0.2,
    description: 'Ajuste manual personalizado por el lector.',
  },
};

export function calculateCircadianKelvin(now: Date = new Date()): number {
  const normTime = now.getHours() + now.getMinutes() / 60;
  if (normTime >= 0 && normTime < 6) {
    const f = normTime / 6;
    return Math.round(1800 + f * (4000 - 1800));
  } else if (normTime >= 6 && normTime < 12) {
    const f = (normTime - 6) / 6;
    return Math.round(4000 + f * (6500 - 4000));
  } else if (normTime >= 12 && normTime < 18) {
    const f = (normTime - 12) / 6;
    return Math.round(6500 - f * (6500 - 3500));
  } else {
    const f = (normTime - 18) / 6;
    return Math.round(3500 - f * (3500 - 1800));
  }
}

export function useAmbientBacklight({
  defaultEnabled = true,
  defaultKelvin = 6500,
  defaultLuminance = 1.0,
  defaultBlueLightReduction = 0.0,
  defaultPaperTintMode = 'neutral',
  defaultCircadianAuto = false,
  enableKeyboard = true,
  hardwareTier = 'low-spec',
}: UseAmbientBacklightOptions = {}) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isEnabled, setIsEnabled] = useState<boolean>(defaultEnabled);
  const [kelvin, setKelvinState] = useState<number>(defaultKelvin);
  const [luminance, setLuminanceState] = useState<number>(defaultLuminance);
  const [blueLightReduction, setBlueLightReductionState] = useState<number>(defaultBlueLightReduction);
  const [paperTintMode, setPaperTintModeState] = useState<PaperTintMode>(defaultPaperTintMode);
  const [circadianAuto, setCircadianAutoState] = useState<boolean>(defaultCircadianAuto);

  const openHUD = useCallback(() => setIsOpen(true), []);
  const closeHUD = useCallback(() => setIsOpen(false), []);
  const toggleHUD = useCallback(() => setIsOpen((prev) => !prev), []);
  const toggleEnabled = useCallback(() => setIsEnabled((prev) => !prev), []);

  const setKelvin = useCallback((k: number) => {
    const clamped = Math.min(6500, Math.max(1800, Math.round(k)));
    setKelvinState(clamped);
    setPaperTintModeState('custom');
  }, []);

  const setLuminance = useCallback((l: number) => {
    const clamped = Math.min(1.5, Math.max(0.3, Math.round(l * 100) / 100));
    setLuminanceState(clamped);
  }, []);

  const setBlueLightReduction = useCallback((b: number) => {
    const clamped = Math.min(0.8, Math.max(0.0, Math.round(b * 100) / 100));
    setBlueLightReductionState(clamped);
  }, []);

  const setCircadianAuto = useCallback((enabled: boolean) => {
    setCircadianAutoState(enabled);
    if (enabled) {
      setKelvinState(calculateCircadianKelvin());
    }
  }, []);

  const applyPreset = useCallback((preset: PaperTintMode) => {
    const config = BACKLIGHT_PRESETS[preset];
    if (config) {
      setPaperTintModeState(preset);
      setKelvinState(config.kelvin);
      setLuminanceState(config.luminance);
      setBlueLightReductionState(config.blueLightReduction);
      setCircadianAutoState(false);
    }
  }, []);

  // Coarse 60s ticker for circadian schedule without CPU polling thrash
  useEffect(() => {
    if (!circadianAuto) return;
    const updateCircadian = () => {
      setKelvinState(calculateCircadianKelvin());
    };
    updateCircadian();
    const interval = setInterval(updateCircadian, 60000);
    return () => clearInterval(interval);
  }, [circadianAuto]);

  // Keyboard shortcut: 'L' or 'l'
  useEffect(() => {
    if (!enableKeyboard) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        toggleHUD();
      } else if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        closeHUD();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enableKeyboard, isOpen, toggleHUD, closeHUD]);

  // Derived effective values
  const effectiveKelvin = circadianAuto ? calculateCircadianKelvin() : kelvin;
  const kNorm = (effectiveKelvin - 1800) / (6500 - 1800);
  const sepiaPct = isEnabled ? Math.round((1.0 - kNorm) * 40 * (1.0 + blueLightReduction * 0.5)) : 0;
  const brightnessPct = isEnabled ? Math.round(luminance * 100) : 100;

  const cssFilter = useMemo(() => {
    if (!isEnabled) return 'none';
    return `brightness(${brightnessPct}%) sepia(${sepiaPct}%)`;
  }, [isEnabled, brightnessPct, sepiaPct]);

  const renderMode = hardwareTier === 'low-spec' ? 'css-solid-glow' : 'svg-filtered-glow';

  return {
    isOpen,
    isEnabled,
    kelvin: effectiveKelvin,
    luminance,
    blueLightReduction,
    paperTintMode,
    circadianAuto,
    cssFilter,
    renderMode,
    openHUD,
    closeHUD,
    toggleHUD,
    toggleEnabled,
    setKelvin,
    setLuminance,
    setBlueLightReduction,
    setPaperTintMode: applyPreset,
    setCircadianAuto,
    applyPreset,
  };
}
