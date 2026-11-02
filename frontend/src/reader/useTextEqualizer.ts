/**
 * KuraScroll - Sprint 97: Adaptive Dynamic Range In-Viewport Text & Kanji Edge Equalizer Hook
 * 
 * Hardware-tuned for Intel Pentium T4500 & Intel GMA 4500MHD.
 * Dynamically sharpens furigana (8-10px) and deepens black ink in dialogue bubbles and dense kanji radicals.
 * Bound to key 'E' for HUD toggling.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

export type EqualizerMode = 'newsprint_vintage' | 'glossy_digital' | 'faded_doujin' | 'custom';

export interface TextEqualizerPresetConfig {
  mode: EqualizerMode;
  label: string;
  blackLevelBoost: number;
  whiteLevelCompression: number;
  kanjiClarityFactor: number;
  isFuriganaSharpenEnabled: boolean;
  description: string;
}

export const TEXT_EQUALIZER_PRESETS: Record<EqualizerMode, TextEqualizerPresetConfig> = {
  newsprint_vintage: {
    mode: 'newsprint_vintage',
    label: 'Newsprint Vintage (Bleed & Grain Neutralizer)',
    blackLevelBoost: 0.35,
    whiteLevelCompression: 0.20,
    kanjiClarityFactor: 1.30,
    isFuriganaSharpenEnabled: true,
    description: 'Boosts faded ink while preventing kanji interior stroke coalescence on aged magazine scans',
  },
  glossy_digital: {
    mode: 'glossy_digital',
    label: 'Glossy Digital (Crisp Clean Lines)',
    blackLevelBoost: 0.15,
    whiteLevelCompression: 0.10,
    kanjiClarityFactor: 1.15,
    isFuriganaSharpenEnabled: false,
    description: 'Mild edge crispness and contrast for pristine modern digital webtoon releases',
  },
  faded_doujin: {
    mode: 'faded_doujin',
    label: 'Faded Doujin / Low-Contrast Ink',
    blackLevelBoost: 0.55,
    whiteLevelCompression: 0.30,
    kanjiClarityFactor: 1.60,
    isFuriganaSharpenEnabled: true,
    description: 'High-energy black point overdrive restoring washed-out grey toner and pencil drafts',
  },
  custom: {
    mode: 'custom',
    label: 'Custom User Equalizer Profile',
    blackLevelBoost: 0.35,
    whiteLevelCompression: 0.20,
    kanjiClarityFactor: 1.30,
    isFuriganaSharpenEnabled: true,
    description: 'Custom tuned black point boost and kanji clarity parameters',
  },
};

export interface UseTextEqualizerProps {
  seriesId?: string;
  initialMode?: EqualizerMode;
}

export interface UseTextEqualizerReturn {
  isEnabled: boolean;
  setIsEnabled: (enabled: boolean) => void;
  isHUDVisible: boolean;
  setIsHUDVisible: (visible: boolean) => void;
  mode: EqualizerMode;
  setMode: (mode: EqualizerMode) => void;
  blackLevelBoost: number;
  setBlackLevelBoost: (val: number) => void;
  whiteLevelCompression: number;
  setWhiteLevelCompression: (val: number) => void;
  kanjiClarityFactor: number;
  setKanjiClarityFactor: (val: number) => void;
  isFuriganaSharpenEnabled: boolean;
  setIsFuriganaSharpenEnabled: (val: boolean) => void;
  effectiveContrast: number;
  effectiveBrightness: number;
  effectiveGamma: number;
  edgeSharpenPx: number;
  compositeFilterCss: string;
  subpixelMatrixCss: string;
  isHighDensityBoostActive: boolean;
  toggleHUD: () => void;
  resetToPreset: (mode: EqualizerMode) => void;
  toggleFuriganaSharpen: () => void;
}

export function useTextEqualizer({
  seriesId,
  initialMode = 'newsprint_vintage',
}: UseTextEqualizerProps = {}): UseTextEqualizerReturn {
  const [isEnabled, setIsEnabled] = useState<boolean>(true);
  const [isHUDVisible, setIsHUDVisible] = useState<boolean>(false);
  const [mode, setModeState] = useState<EqualizerMode>(initialMode);

  const initialConfig = TEXT_EQUALIZER_PRESETS[initialMode] || TEXT_EQUALIZER_PRESETS.newsprint_vintage;
  const [blackLevelBoost, setBlackLevelBoost] = useState<number>(initialConfig.blackLevelBoost);
  const [whiteLevelCompression, setWhiteLevelCompression] = useState<number>(initialConfig.whiteLevelCompression);
  const [kanjiClarityFactor, setKanjiClarityFactor] = useState<number>(initialConfig.kanjiClarityFactor);
  const [isFuriganaSharpenEnabled, setIsFuriganaSharpenEnabled] = useState<boolean>(initialConfig.isFuriganaSharpenEnabled);

  const toggleHUD = useCallback(() => {
    setIsHUDVisible((prev) => !prev);
  }, []);

  const resetToPreset = useCallback((targetMode: EqualizerMode) => {
    const config = TEXT_EQUALIZER_PRESETS[targetMode] || TEXT_EQUALIZER_PRESETS.newsprint_vintage;
    setModeState(targetMode);
    setBlackLevelBoost(config.blackLevelBoost);
    setWhiteLevelCompression(config.whiteLevelCompression);
    setKanjiClarityFactor(config.kanjiClarityFactor);
    setIsFuriganaSharpenEnabled(config.isFuriganaSharpenEnabled);
  }, []);

  const setMode = useCallback((newMode: EqualizerMode) => {
    resetToPreset(newMode);
  }, [resetToPreset]);

  const toggleFuriganaSharpen = useCallback(() => {
    setIsFuriganaSharpenEnabled((prev) => !prev);
  }, []);

  // Keyboard shortcut: 'E' toggles HUD
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        (activeEl && (activeEl as HTMLElement).isContentEditable);

      if (isInput) return;

      if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        toggleHUD();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleHUD]);

  // Derived filter calculations
  const {
    effectiveContrast,
    effectiveBrightness,
    effectiveGamma,
    edgeSharpenPx,
    compositeFilterCss,
    subpixelMatrixCss,
    isHighDensityBoostActive,
  } = useMemo(() => {
    if (!isEnabled) {
      return {
        effectiveContrast: 1.00,
        effectiveBrightness: 1.00,
        effectiveGamma: 1.00,
        edgeSharpenPx: 0,
        compositeFilterCss: 'none',
        subpixelMatrixCss: 'none',
        isHighDensityBoostActive: false,
      };
    }

    const clampedBlackBoost = Math.max(0.00, Math.min(1.00, parseFloat(blackLevelBoost.toFixed(2))));
    const clampedWhiteComp = Math.max(0.00, Math.min(1.00, parseFloat(whiteLevelCompression.toFixed(2))));
    const clampedClarity = Math.max(1.00, Math.min(2.50, parseFloat(kanjiClarityFactor.toFixed(2))));

    const contrast = parseFloat((1.00 + clampedBlackBoost * 0.45).toFixed(2));
    const brightness = parseFloat((1.00 - clampedWhiteComp * 0.12).toFixed(2));
    const gamma = parseFloat((1.00 / (1.00 + clampedBlackBoost * 0.25)).toFixed(2));

    const edgeSharpen = isFuriganaSharpenEnabled
      ? parseFloat(((clampedClarity - 1.00) * 0.60).toFixed(2))
      : 0;

    const compositeFilter = `contrast(${contrast}) brightness(${brightness})`;
    const subpixelMatrix = edgeSharpen > 0.05
      ? `drop-shadow(${edgeSharpen}px 0 0 rgba(0,0,0,0.40)) drop-shadow(0 ${edgeSharpen}px 0 rgba(0,0,0,0.40))`
      : 'none';

    return {
      effectiveContrast: contrast,
      effectiveBrightness: brightness,
      effectiveGamma: gamma,
      edgeSharpenPx: edgeSharpen,
      compositeFilterCss: compositeFilter,
      subpixelMatrixCss: subpixelMatrix,
      isHighDensityBoostActive: clampedClarity >= 1.25,
    };
  }, [isEnabled, blackLevelBoost, whiteLevelCompression, kanjiClarityFactor, isFuriganaSharpenEnabled]);

  return {
    isEnabled,
    setIsEnabled,
    isHUDVisible,
    setIsHUDVisible,
    mode,
    setMode,
    blackLevelBoost,
    setBlackLevelBoost,
    whiteLevelCompression,
    setWhiteLevelCompression,
    kanjiClarityFactor,
    setKanjiClarityFactor,
    isFuriganaSharpenEnabled,
    setIsFuriganaSharpenEnabled,
    effectiveContrast,
    effectiveBrightness,
    effectiveGamma,
    edgeSharpenPx,
    compositeFilterCss,
    subpixelMatrixCss,
    isHighDensityBoostActive,
    toggleHUD,
    resetToPreset,
    toggleFuriganaSharpen,
  };
}
