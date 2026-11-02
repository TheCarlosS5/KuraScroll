/**
 * KuraScroll - Sprint 113: Subpixel Micro-Vector Glyph Sharpener & Anti-Aliasing Edge Contrast Enhancer Hook
 * 
 * Hardware Target: Intel Pentium T4500 (2C/2T @ 2.30 GHz, Penryn 45nm, no AVX, heap <= 512MB) & Intel GMA 4500MHD.
 * Synthesizes zero-allocation edge contrast enhancement for dense CJK kanji, hangul, and furigana.
 * Bound to key 'K' / 'k' for HUD toggling.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

export type SharpenerMode =
  | 'adaptive_kanji'
  | 'high_contrast_furigana'
  | 'kana_light'
  | 'dense_cjk_compaction'
  | 'custom_matrix';

export type StrokeDensityTier =
  | 'auto'
  | 'low_kana_1_5'
  | 'mid_kanji_6_14'
  | 'dense_kanji_15_plus';

export interface GlyphSharpenerProfile {
  seriesId: string;
  sharpenerMode: SharpenerMode;
  strokeDensityTier: StrokeDensityTier;
  contrastMultiplier: number;
  luminanceGamma: number;
  strokeProtectionPct: number;
  isEnabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface GlyphSharpenerResult {
  sharpenerMode: SharpenerMode;
  effectiveContrast: number;
  effectiveBrightness: number;
  strokeProtectionFactor: number;
  cssFilter: string;
  textRendering: string;
  webkitFontSmoothing: string;
  isDenseStrokeCompensated: boolean;
  latencyUs: number;
}

export interface GlyphSharpenerPreset {
  name: SharpenerMode;
  sharpenerMode: SharpenerMode;
  label: string;
  strokeDensityTier: StrokeDensityTier;
  contrastMultiplier: number;
  luminanceGamma: number;
  strokeProtectionPct: number;
  description: string;
}

export const GLYPH_SHARPENER_PRESETS: Record<SharpenerMode, GlyphSharpenerPreset> = {
  adaptive_kanji: {
    name: 'adaptive_kanji',
    sharpenerMode: 'adaptive_kanji',
    label: 'Adaptive CJK Kanji & Furigana Optimizer',
    strokeDensityTier: 'auto',
    contrastMultiplier: 1.15,
    luminanceGamma: 1.05,
    strokeProtectionPct: 65,
    description: 'Balanced contrast enhancement with automatic stroke space preservation for 6-14 stroke kanji',
  },
  high_contrast_furigana: {
    name: 'high_contrast_furigana',
    sharpenerMode: 'high_contrast_furigana',
    label: 'High-Contrast Furigana & Micro-Ruby Accent',
    strokeDensityTier: 'low_kana_1_5',
    contrastMultiplier: 1.25,
    luminanceGamma: 1.10,
    strokeProtectionPct: 40,
    description: 'Maximum edge definition for tiny 6px-9px ruby glosses beside complex kanji',
  },
  kana_light: {
    name: 'kana_light',
    sharpenerMode: 'kana_light',
    label: 'Gentle Hiragana & Katakana Soft Edge',
    strokeDensityTier: 'low_kana_1_5',
    contrastMultiplier: 1.08,
    luminanceGamma: 1.00,
    strokeProtectionPct: 20,
    description: 'Subtle edge sharpening suited for simple curve-heavy phonetic kana without dark fringing',
  },
  dense_cjk_compaction: {
    name: 'dense_cjk_compaction',
    sharpenerMode: 'dense_cjk_compaction',
    label: 'Ultra-Dense Kanji Anti-Fill-In Protection (15+ Strokes)',
    strokeDensityTier: 'dense_kanji_15_plus',
    contrastMultiplier: 1.10,
    luminanceGamma: 0.98,
    strokeProtectionPct: 85,
    description: 'Strict stroke separation protection preventing complex characters (e.g. 鬱, 議, 龍) from bleeding together',
  },
  custom_matrix: {
    name: 'custom_matrix',
    sharpenerMode: 'custom_matrix',
    label: 'Custom User-Tuned Matrix',
    strokeDensityTier: 'auto',
    contrastMultiplier: 1.15,
    luminanceGamma: 1.05,
    strokeProtectionPct: 50,
    description: 'Fully manual calibration of contrast boost and luminance gamma',
  },
};

export function localCalculateGlyphSharpener(
  strokeCount: number = 8,
  devicePixelRatio: number = 1.0,
  contrastMultiplier: number = 1.15,
  luminanceGamma: number = 1.05,
  strokeProtectionPct: number = 65,
  mode: SharpenerMode = 'adaptive_kanji',
  isEnabled: boolean = true
): GlyphSharpenerResult {
  const t0 = performance.now();

  if (!isEnabled) {
    const latencyUs = (performance.now() - t0) * 1000;
    return {
      sharpenerMode: mode,
      effectiveContrast: 1.0,
      effectiveBrightness: 1.0,
      strokeProtectionFactor: 0.0,
      cssFilter: 'none',
      textRendering: 'auto',
      webkitFontSmoothing: 'auto',
      isDenseStrokeCompensated: false,
      latencyUs,
    };
  }

  const safeStrokes = Math.max(1, strokeCount);
  const safeDpr = Math.max(0.5, Math.min(3.0, devicePixelRatio));
  const safeContrast = Math.max(1.0, Math.min(1.50, contrastMultiplier));
  const safeGamma = Math.max(0.80, Math.min(1.30, luminanceGamma));
  const safeProtection = Math.max(0, Math.min(100, strokeProtectionPct));

  const isDense = safeStrokes >= 14 || mode === 'dense_cjk_compaction';
  const densityRatio = Math.min(1.0, safeStrokes / 24.0);
  const strokeProtectionFactor = isDense
    ? (safeProtection / 100.0) * densityRatio
    : (safeProtection / 100.0) * densityRatio * 0.5;

  const rawBoost = safeContrast - 1.0;
  const moderatedBoost = rawBoost * (1.0 - strokeProtectionFactor * 0.6);
  const dprDamping = 1.0 / Math.max(1.0, safeDpr * 0.85);
  const effectiveContrast = Math.round((1.0 + moderatedBoost * dprDamping) * 1000) / 1000;
  const effectiveBrightness = Math.round((1.0 / safeGamma) * 1000) / 1000;

  const cssFilter =
    effectiveContrast === 1.0 && effectiveBrightness === 1.0
      ? 'none'
      : `contrast(${effectiveContrast.toFixed(3)}) brightness(${effectiveBrightness.toFixed(3)})`;

  const latencyUs = (performance.now() - t0) * 1000;

  return {
    sharpenerMode: mode,
    effectiveContrast,
    effectiveBrightness,
    strokeProtectionFactor: Math.round(strokeProtectionFactor * 1000) / 1000,
    cssFilter,
    textRendering: 'geometricPrecision',
    webkitFontSmoothing: 'antialiased',
    isDenseStrokeCompensated: isDense,
    latencyUs,
  };
}

export function useGlyphSharpener(seriesId: string = 'default-series') {
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [profile, setProfile] = useState<GlyphSharpenerProfile>({
    seriesId,
    ...GLYPH_SHARPENER_PRESETS.adaptive_kanji,
    isEnabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  // Keyboard shortcut 'K' / 'k' (Kanji & Glyph Sharpener)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || (document.activeElement as HTMLElement)?.isContentEditable) {
        return;
      }

      if (e.key === 'k' || e.key === 'K') {
        if (!e.ctrlKey && !e.altKey && !e.metaKey) {
          e.preventDefault();
          setIsVisible((prev) => !prev);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const calculate = useCallback(
    (strokeCount: number = 8, dpr: number = 1.0): GlyphSharpenerResult => {
      return localCalculateGlyphSharpener(
        strokeCount,
        dpr,
        profile.contrastMultiplier,
        profile.luminanceGamma,
        profile.strokeProtectionPct,
        profile.sharpenerMode,
        profile.isEnabled
      );
    },
    [profile]
  );

  const sampleResult = useMemo(() => {
    return calculate(8, 1.0);
  }, [calculate]);

  const setPreset = useCallback((presetName: SharpenerMode) => {
    const preset = GLYPH_SHARPENER_PRESETS[presetName];
    if (preset) {
      setProfile((prev) => ({
        ...prev,
        sharpenerMode: preset.sharpenerMode,
        strokeDensityTier: preset.strokeDensityTier,
        contrastMultiplier: preset.contrastMultiplier,
        luminanceGamma: preset.luminanceGamma,
        strokeProtectionPct: preset.strokeProtectionPct,
        updatedAt: Date.now(),
      }));
    }
  }, []);

  const updateProfile = useCallback((params: Partial<GlyphSharpenerProfile>) => {
    setProfile((prev) => ({
      ...prev,
      ...params,
      updatedAt: Date.now(),
    }));
  }, []);

  const toggleVisibility = useCallback(() => {
    setIsVisible((prev) => !prev);
  }, []);

  return {
    isVisible,
    setIsVisible,
    toggleVisibility,
    profile,
    updateProfile,
    sampleResult,
    calculate,
    setPreset,
  };
}
