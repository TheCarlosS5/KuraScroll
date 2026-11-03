/**
 * KuraScroll - Sprint 124: Subpixel Font Kerning & CJK Stroke Density Balancer Hook
 * 
 * Hardware Target: Intel Pentium T4500 (2C/2T @ 2.30 GHz, Penryn 45nm, no AVX, heap <= 512MB) & Intel GMA 4500MHD.
 * Pure zero-allocation bitwise CJK range classification and analytical optical kerning evaluation.
 * Bound to key 'K' / 'k' for HUD toggling.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

export type CJKPresetName =
  | 'manga_dense_kanji'
  | 'webtoon_hangul_flow'
  | 'furigana_compact'
  | 'dialogue_whisper'
  | 'raw_fixed';

export type CJKDensityType = 'kanji' | 'kana' | 'hangul' | 'latin' | 'other';

export interface CJKKerningProfile {
  seriesId: string;
  presetName: CJKPresetName;
  baseKerningEm: number;
  trackingRatio: number;
  minKerningEm: number;
  maxKerningEm: number;
  opticalWeightRatio: number;
  isEnabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface CJKKerningPreset {
  name: CJKPresetName;
  label: string;
  baseKerningEm: number;
  trackingRatio: number;
  minKerningEm: number;
  maxKerningEm: number;
  opticalWeightRatio: number;
  description: string;
}

export const CJK_KERNING_PRESETS: Record<CJKPresetName, CJKKerningPreset> = {
  manga_dense_kanji: {
    name: 'manga_dense_kanji',
    label: 'Manga Dense Kanji Optical Balancer',
    baseKerningEm: 0.04,
    trackingRatio: 0.015,
    minKerningEm: -0.02,
    maxKerningEm: 0.20,
    opticalWeightRatio: 0.25,
    description: 'Expands letter-spacing for dense 15+ stroke kanji, preventing stroke clumping on TN displays.',
  },
  webtoon_hangul_flow: {
    name: 'webtoon_hangul_flow',
    label: 'Webtoon Hangul Flow',
    baseKerningEm: 0.02,
    trackingRatio: 0.010,
    minKerningEm: -0.01,
    maxKerningEm: 0.15,
    opticalWeightRatio: 0.15,
    description: 'Harmonious letter-spacing for Korean hangul syllables and mixed webtoon onomatopoeia.',
  },
  furigana_compact: {
    name: 'furigana_compact',
    label: 'Furigana Ruby Compact Spacing',
    baseKerningEm: -0.02,
    trackingRatio: 0.005,
    minKerningEm: -0.05,
    maxKerningEm: 0.08,
    opticalWeightRatio: 0.10,
    description: 'Tightens spacing for tiny kana ruby annotations placed directly adjacent to kanji.',
  },
  dialogue_whisper: {
    name: 'dialogue_whisper',
    label: 'Dialogue Whisper Airy Tracking',
    baseKerningEm: 0.08,
    trackingRatio: 0.020,
    minKerningEm: 0.00,
    maxKerningEm: 0.25,
    opticalWeightRatio: 0.30,
    description: 'Airy spacious typesetting for quiet thoughts, whispers, and narrative soliloquy balloons.',
  },
  raw_fixed: {
    name: 'raw_fixed',
    label: 'Raw Fixed Spacing (Pass-Through)',
    baseKerningEm: 0.00,
    trackingRatio: 0.000,
    minKerningEm: 0.00,
    maxKerningEm: 0.00,
    opticalWeightRatio: 0.00,
    description: 'Bypasses dynamic kerning returning standard font metrics without modification.',
  },
};

export interface CJKKerningResult {
  densityType: CJKDensityType;
  strokeComplexity: number;
  kerningEm: number;
  opticalWeightRatio: number;
  cssLetterSpacing: string;
  latencyUs: number;
}

export function localCalculateCJKKerning(
  codepoint: number,
  baseKerningEm: number = 0.04,
  trackingRatio: number = 0.015,
  minKerningEm: number = -0.02,
  maxKerningEm: number = 0.20,
  opticalWeightRatio: number = 0.25,
  isEnabled: boolean = true
): CJKKerningResult {
  const startHr = typeof performance !== 'undefined' ? performance.now() : 0;

  if (!isEnabled) {
    return {
      densityType: 'other',
      strokeComplexity: 3.0,
      kerningEm: 0.0,
      opticalWeightRatio: 1.0,
      cssLetterSpacing: '0em',
      latencyUs: typeof performance !== 'undefined' ? (performance.now() - startHr) * 1000 : 0.2,
    };
  }

  let densityType: CJKDensityType = 'other';
  let strokeComplexity = 3.0;

  if ((codepoint >= 0x4e00 && codepoint <= 0x9fff) || (codepoint >= 0x3400 && codepoint <= 0x4dbf)) {
    densityType = 'kanji';
    strokeComplexity = 12.0;
  } else if (codepoint >= 0xf900 && codepoint <= 0xfaff) {
    densityType = 'kanji';
    strokeComplexity = 14.0;
  } else if (codepoint >= 0x3040 && codepoint <= 0x309f) {
    densityType = 'kana';
    strokeComplexity = 2.5;
  } else if (codepoint >= 0x30a0 && codepoint <= 0x30ff) {
    densityType = 'kana';
    strokeComplexity = 2.5;
  } else if (codepoint >= 0xac00 && codepoint <= 0xd7af) {
    densityType = 'hangul';
    strokeComplexity = 6.0;
  } else if (codepoint <= 0x024f) {
    densityType = 'latin';
    strokeComplexity = 1.5;
  }

  const refDensity = 4.0;
  const rawKerning = baseKerningEm + trackingRatio * (strokeComplexity - refDensity);
  const minK = Math.max(-0.20, Math.min(0.0, minKerningEm));
  const maxK = Math.max(0.0, Math.min(1.0, maxKerningEm));
  const kerningEm = Math.max(minK, Math.min(maxK, rawKerning));

  const clampedWeightRatio = Math.max(0.0, Math.min(1.0, opticalWeightRatio));
  const optWeight = Math.max(
    0.70,
    Math.min(1.15, 1.0 - clampedWeightRatio * ((strokeComplexity - refDensity) / 20.0))
  );

  const endHr = typeof performance !== 'undefined' ? performance.now() : 0;

  return {
    densityType,
    strokeComplexity,
    kerningEm,
    opticalWeightRatio: optWeight,
    cssLetterSpacing: `${kerningEm.toFixed(4)}em`,
    latencyUs: typeof performance !== 'undefined' ? (endHr - startHr) * 1000 : 0.2,
  };
}

export function useCJKKerning(seriesId: string) {
  const [isHUDOpen, setIsHUDOpen] = useState(false);
  const [presetName, setPresetName] = useState<CJKPresetName>('manga_dense_kanji');
  const [baseKerningEm, setBaseKerningEm] = useState(0.04);
  const [trackingRatio, setTrackingRatio] = useState(0.015);
  const [minKerningEm, setMinKerningEm] = useState(-0.02);
  const [maxKerningEm, setMaxKerningEm] = useState(0.20);
  const [opticalWeightRatio, setOpticalWeightRatio] = useState(0.25);
  const [isEnabled, setIsEnabled] = useState(true);

  // Live test glyph sample (default: '龍' dragon - complex kanji)
  const [sampleChar, setSampleChar] = useState('龍');

  const codepoint = useMemo(
    () => (sampleChar && sampleChar.length > 0 ? sampleChar.codePointAt(0) ?? 0x4e00 : 0x4e00),
    [sampleChar]
  );

  const currentResult = useMemo(
    () =>
      localCalculateCJKKerning(
        codepoint,
        baseKerningEm,
        trackingRatio,
        minKerningEm,
        maxKerningEm,
        opticalWeightRatio,
        isEnabled
      ),
    [
      codepoint,
      baseKerningEm,
      trackingRatio,
      minKerningEm,
      maxKerningEm,
      opticalWeightRatio,
      isEnabled,
    ]
  );

  // Keyboard hotkey 'K' / 'k' toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        (activeEl as HTMLElement)?.isContentEditable;

      if (!isInput && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setIsHUDOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const selectPreset = useCallback((presetKey: CJKPresetName) => {
    setPresetName(presetKey);
    const p = CJK_KERNING_PRESETS[presetKey];
    if (p) {
      setBaseKerningEm(p.baseKerningEm);
      setTrackingRatio(p.trackingRatio);
      setMinKerningEm(p.minKerningEm);
      setMaxKerningEm(p.maxKerningEm);
      setOpticalWeightRatio(p.opticalWeightRatio);
    }
  }, []);

  return {
    isHUDOpen,
    setIsHUDOpen,
    presetName,
    setPresetName,
    baseKerningEm,
    setBaseKerningEm,
    trackingRatio,
    setTrackingRatio,
    minKerningEm,
    setMinKerningEm,
    maxKerningEm,
    setMaxKerningEm,
    opticalWeightRatio,
    setOpticalWeightRatio,
    isEnabled,
    setIsEnabled,
    sampleChar,
    setSampleChar,
    currentResult,
    selectPreset,
  };
}
