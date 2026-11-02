/**
 * KuraScroll - Sprint 89: Adaptive Contrast Dynamic Range & HDR Tone-Mapping Hook
 * 
 * Hardware-tuned for Intel Pentium T4500 & Intel GMA 4500MHD.
 * Provides client-side parametric tone curve mapping:
 * eliminates washed out ink while compressing pure whites for dim/dark reading.
 * Bound to key 'X' for HUD toggling.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

export type AmbientAdaptationMode = 'cinema_night' | 'daylight_boost' | 'oled_pure_black';

export interface DynamicTonePresetConfig {
  mode: AmbientAdaptationMode;
  label: string;
  gammaExponent: number;
  blackPointLift: number;
  whitePointCompress: number;
  description: string;
}

export const DYNAMIC_TONE_PRESETS: Record<AmbientAdaptationMode, DynamicTonePresetConfig> = {
  cinema_night: {
    mode: 'cinema_night',
    label: 'Cinema Night (Dark Room)',
    gammaExponent: 1.15,
    blackPointLift: 0.04,
    whitePointCompress: 0.92,
    description: 'Softens stark white glare and gently lifts dark cross-hatching in dim rooms',
  },
  daylight_boost: {
    mode: 'daylight_boost',
    label: 'Daylight Boost (High Lux)',
    gammaExponent: 0.90,
    blackPointLift: 0.10,
    whitePointCompress: 1.00,
    description: 'Punchy shadow boost and maximum white brightness to cut through bright glare',
  },
  oled_pure_black: {
    mode: 'oled_pure_black',
    label: 'OLED Pure Black (Ink Protection)',
    gammaExponent: 1.00,
    blackPointLift: 0.00,
    whitePointCompress: 0.92,
    description: 'Preserves 100% deep true blacks for dark fantasy manga (Berserk, Tokyo Ghoul)',
  },
};

export interface UseDynamicToneProps {
  seriesId?: string;
  initialMode?: AmbientAdaptationMode;
}

export interface UseDynamicToneReturn {
  isEnabled: boolean;
  setIsEnabled: (enabled: boolean) => void;
  isHUDVisible: boolean;
  setIsHUDVisible: (visible: boolean) => void;
  mode: AmbientAdaptationMode;
  setMode: (mode: AmbientAdaptationMode) => void;
  gammaExponent: number;
  setGammaExponent: (val: number) => void;
  blackPointLift: number;
  setBlackPointLift: (val: number) => void;
  whitePointCompress: number;
  setWhitePointCompress: (val: number) => void;
  contrastPercent: number;
  brightnessPercent: number;
  cssFilterString: string;
  estimatedNitsDelta: number;
  toggleHUD: () => void;
  resetToPreset: (mode: AmbientAdaptationMode) => void;
}

export function useDynamicTone({
  seriesId,
  initialMode = 'cinema_night',
}: UseDynamicToneProps = {}): UseDynamicToneReturn {
  const [isEnabled, setIsEnabled] = useState<boolean>(true);
  const [isHUDVisible, setIsHUDVisible] = useState<boolean>(false);
  const [mode, setModeState] = useState<AmbientAdaptationMode>(initialMode);

  const initialConfig = DYNAMIC_TONE_PRESETS[initialMode] || DYNAMIC_TONE_PRESETS.cinema_night;
  const [gammaExponent, setGammaExponent] = useState<number>(initialConfig.gammaExponent);
  const [blackPointLift, setBlackPointLift] = useState<number>(initialConfig.blackPointLift);
  const [whitePointCompress, setWhitePointCompress] = useState<number>(initialConfig.whitePointCompress);

  const toggleHUD = useCallback(() => {
    setIsHUDVisible((prev) => !prev);
  }, []);

  const resetToPreset = useCallback((targetMode: AmbientAdaptationMode) => {
    const config = DYNAMIC_TONE_PRESETS[targetMode] || DYNAMIC_TONE_PRESETS.cinema_night;
    setModeState(targetMode);
    setGammaExponent(config.gammaExponent);
    setBlackPointLift(config.blackPointLift);
    setWhitePointCompress(config.whitePointCompress);
  }, []);

  const setMode = useCallback((newMode: AmbientAdaptationMode) => {
    resetToPreset(newMode);
  }, [resetToPreset]);

  // Derived filter calculations (Zero-allocation pure arithmetic)
  const { contrastPercent, brightnessPercent, cssFilterString, estimatedNitsDelta } = useMemo(() => {
    if (!isEnabled) {
      return {
        contrastPercent: 100,
        brightnessPercent: 100,
        cssFilterString: 'none',
        estimatedNitsDelta: 0,
      };
    }

    const clampedGamma = Math.max(0.50, Math.min(2.50, gammaExponent));
    const clampedLift = Math.max(0.00, Math.min(0.25, blackPointLift));
    const clampedCompress = Math.max(0.70, Math.min(1.00, whitePointCompress));

    const dynamicSpan = clampedCompress - clampedLift;
    const contrastFactor = dynamicSpan / clampedGamma;
    const contrast = Math.max(50, Math.min(200, Math.round(contrastFactor * 125)));

    const brightnessFactor = (1.0 + clampedLift) * clampedCompress;
    const brightness = Math.max(70, Math.min(150, Math.round(brightnessFactor * 100)));

    const filterStr = `contrast(${contrast}%) brightness(${brightness}%)`;
    const nitsDelta = parseFloat(((clampedCompress - 1.0) * 120 + clampedLift * 40).toFixed(1));

    return {
      contrastPercent: contrast,
      brightnessPercent: brightness,
      cssFilterString: filterStr,
      estimatedNitsDelta: nitsDelta,
    };
  }, [isEnabled, gammaExponent, blackPointLift, whitePointCompress]);

  // Global hotkey 'X' listener
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

      if (e.key === 'x' || e.key === 'X') {
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
    gammaExponent,
    setGammaExponent,
    blackPointLift,
    setBlackPointLift,
    whitePointCompress,
    setWhitePointCompress,
    contrastPercent,
    brightnessPercent,
    cssFilterString,
    estimatedNitsDelta,
    toggleHUD,
    resetToPreset,
  };
}
