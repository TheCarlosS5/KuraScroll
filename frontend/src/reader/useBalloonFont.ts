/**
 * KuraScroll - Sprint 106: Adaptive Viewport Spatial Dialogue Balloon Glyph & Text Auto-Scaler Hook
 * 
 * Hardware-tuned for Intel Pentium T4500 (2C/2T @ 2.3GHz, Penryn 45nm, no AVX) & Intel GMA 4500MHD.
 * Dynamically scales speech balloon text to guarantee comfortable legibility on 720p/1080p laptop displays.
 * Bound to key 'F' / 'f' for HUD toggling.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

export type FontScalingMode = 'comfort_legibility' | 'compact_dialogue' | 'large_print' | 'disabled' | 'custom';

export interface BalloonFontProfile {
  seriesId: string;
  scalingMode: FontScalingMode;
  minFontSizePx: number;
  maxFontSizePx: number;
  targetDensityRatio: number;
  isFuriganaPreserved: boolean;
  isEnabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface BalloonFontScaleResult {
  optimalFontSizePx: number;
  scaleRatio: number;
  lineCapacityEstimate: number;
  maxCharsEstimate: number;
  isFuriganaSafe: boolean;
  isOverflowSafe: boolean;
  scalingMode: FontScalingMode;
  latencyUs: number;
}

export interface BalloonFontPreset {
  name: FontScalingMode;
  scalingMode: FontScalingMode;
  label: string;
  minFontSizePx: number;
  maxFontSizePx: number;
  targetDensityRatio: number;
  isFuriganaPreserved: boolean;
  description: string;
}

export const BALLOON_FONT_PRESETS: Record<FontScalingMode, BalloonFontPreset> = {
  comfort_legibility: {
    name: 'comfort_legibility',
    scalingMode: 'comfort_legibility',
    label: 'Comfort Legibility (Standard Manga)',
    minFontSizePx: 12,
    maxFontSizePx: 28,
    targetDensityRatio: 0.65,
    isFuriganaPreserved: true,
    description: 'Balanced optical enlargement preventing eyestrain on vintage scans while protecting ruby furigana',
  },
  compact_dialogue: {
    name: 'compact_dialogue',
    scalingMode: 'compact_dialogue',
    label: 'Compact Dialogue (Dense Webtoon)',
    minFontSizePx: 10,
    maxFontSizePx: 22,
    targetDensityRatio: 0.80,
    isFuriganaPreserved: false,
    description: 'Higher character density fitting verbose narration within compact webtoon speech bubbles',
  },
  large_print: {
    name: 'large_print',
    scalingMode: 'large_print',
    label: 'Large Print (Accessible Vision)',
    minFontSizePx: 16,
    maxFontSizePx: 38,
    targetDensityRatio: 0.50,
    isFuriganaPreserved: true,
    description: 'Magnified optical glyphs designed for maximum contrast and readability on small laptop screens',
  },
  disabled: {
    name: 'disabled',
    scalingMode: 'disabled',
    label: 'Disabled (Raw Viewport)',
    minFontSizePx: 10,
    maxFontSizePx: 32,
    targetDensityRatio: 0.65,
    isFuriganaPreserved: false,
    description: 'Native unscaled font rendering without optical container adaptations',
  },
  custom: {
    name: 'custom',
    scalingMode: 'custom',
    label: 'Custom User Typography',
    minFontSizePx: 12,
    maxFontSizePx: 28,
    targetDensityRatio: 0.65,
    isFuriganaPreserved: true,
    description: 'User-calibrated optical scaling and density parameters',
  },
};

export function localCalculateBalloonFontScale(
  balloonWidth: number = 240,
  balloonHeight: number = 180,
  textLength: number = 32,
  viewportWidth: number = 1280,
  viewportHeight: number = 720,
  minFontSizePx: number = 12,
  maxFontSizePx: number = 28,
  targetDensityRatio: number = 0.65,
  isFuriganaPreserved: boolean = true,
  mode: FontScalingMode = 'comfort_legibility',
  isEnabled: boolean = true
): BalloonFontScaleResult {
  const startHr = typeof performance !== 'undefined' ? performance.now() : 0;

  const minPx = Math.max(6, Math.min(24, minFontSizePx));
  const maxPx = Math.max(16, Math.min(72, maxFontSizePx));
  const density = Math.max(0.20, Math.min(0.95, targetDensityRatio));
  const len = Math.max(1, textLength);
  const bw = Math.max(10, balloonWidth);
  const bh = Math.max(10, balloonHeight);
  const vw = Math.max(320, Math.min(3840, viewportWidth));

  if (!isEnabled || mode === 'disabled') {
    const endHr = typeof performance !== 'undefined' ? performance.now() : 0;
    return {
      optimalFontSizePx: minPx,
      scaleRatio: 1.0,
      lineCapacityEstimate: 1,
      maxCharsEstimate: len,
      isFuriganaSafe: isFuriganaPreserved,
      isOverflowSafe: true,
      scalingMode: mode,
      latencyUs: (endHr - startHr) * 1000,
    };
  }

  const paddingX = 16;
  const furiganaHeightFactor = isFuriganaPreserved ? 0.76 : 0.88;
  const availW = Math.max(8, bw - paddingX);
  const availH = Math.max(8, bh * furiganaHeightFactor);
  const availArea = availW * availH;

  const viewportScale = Math.pow(vw / 1280, 0.25);
  const estimatedCharFootprint = len * 0.90;
  const rawFontSq = (availArea * density) / Math.max(1, estimatedCharFootprint);
  let optimalFont = Math.sqrt(Math.max(1, rawFontSq)) * viewportScale;

  optimalFont = Math.max(minPx, Math.min(maxPx, Math.round(optimalFont)));

  const charWidth = optimalFont * 0.65;
  const lineHeight = optimalFont * 1.35;
  const charsPerLine = Math.max(1, Math.floor(availW / charWidth));
  const maxLines = Math.max(1, Math.floor(availH / lineHeight));
  const maxCharsEstimate = charsPerLine * maxLines;
  let isOverflowSafe = maxCharsEstimate >= len;

  if (!isOverflowSafe && optimalFont > minPx) {
    const fitFont = Math.sqrt((availArea * density) / (len * 1.05)) * viewportScale;
    optimalFont = Math.max(minPx, Math.min(optimalFont, Math.round(fitFont)));
    const revisedCharsPerLine = Math.max(1, Math.floor(availW / (optimalFont * 0.65)));
    const revisedLines = Math.max(1, Math.floor(availH / (optimalFont * 1.35)));
    isOverflowSafe = (revisedCharsPerLine * revisedLines) >= len;
  }

  const baselineFont = 14;
  const scaleRatio = Number((optimalFont / baselineFont).toFixed(2));
  const endHr = typeof performance !== 'undefined' ? performance.now() : 0;

  return {
    optimalFontSizePx: optimalFont,
    scaleRatio,
    lineCapacityEstimate: charsPerLine,
    maxCharsEstimate,
    isFuriganaSafe: isFuriganaPreserved,
    isOverflowSafe,
    scalingMode: mode,
    latencyUs: (endHr - startHr) * 1000,
  };
}

export interface UseBalloonFontProps {
  seriesId?: string;
  initialMode?: FontScalingMode;
  balloonWidth?: number;
  balloonHeight?: number;
  textLength?: number;
  viewportWidth?: number;
  viewportHeight?: number;
}

export interface UseBalloonFontReturn {
  isHUDVisible: boolean;
  setIsHUDVisible: (visible: boolean | ((prev: boolean) => boolean)) => void;
  toggleHUD: () => void;
  profile: BalloonFontProfile;
  setProfile: React.Dispatch<React.SetStateAction<BalloonFontProfile>>;
  result: BalloonFontScaleResult;
  applyPreset: (mode: FontScalingMode) => void;
}

export function useBalloonFont(props: UseBalloonFontProps = {}): UseBalloonFontReturn {
  const {
    seriesId = 'default-series',
    initialMode = 'comfort_legibility',
    balloonWidth = 240,
    balloonHeight = 180,
    textLength = 32,
    viewportWidth = 1280,
    viewportHeight = 720,
  } = props;

  const [isHUDVisible, setIsHUDVisible] = useState(false);

  const initialProfile = useMemo<BalloonFontProfile>(() => {
    const preset = BALLOON_FONT_PRESETS[initialMode] || BALLOON_FONT_PRESETS.comfort_legibility;
    return {
      seriesId,
      scalingMode: preset.scalingMode,
      minFontSizePx: preset.minFontSizePx,
      maxFontSizePx: preset.maxFontSizePx,
      targetDensityRatio: preset.targetDensityRatio,
      isFuriganaPreserved: preset.isFuriganaPreserved,
      isEnabled: true,
      createdAt: 0,
      updatedAt: 0,
    };
  }, [seriesId, initialMode]);

  const [profile, setProfile] = useState<BalloonFontProfile>(initialProfile);

  const toggleHUD = useCallback(() => {
    setIsHUDVisible(prev => !prev);
  }, []);

  // Keyboard shortcut listener: 'F' / 'f'
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
        return;
      }
      if (event.key === 'f' || event.key === 'F') {
        event.preventDefault();
        toggleHUD();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleHUD]);

  // Compute optical font scaling result
  const result = useMemo(() => {
    return localCalculateBalloonFontScale(
      balloonWidth,
      balloonHeight,
      textLength,
      viewportWidth,
      viewportHeight,
      profile.minFontSizePx,
      profile.maxFontSizePx,
      profile.targetDensityRatio,
      profile.isFuriganaPreserved,
      profile.scalingMode,
      profile.isEnabled
    );
  }, [
    balloonWidth,
    balloonHeight,
    textLength,
    viewportWidth,
    viewportHeight,
    profile.minFontSizePx,
    profile.maxFontSizePx,
    profile.targetDensityRatio,
    profile.isFuriganaPreserved,
    profile.scalingMode,
    profile.isEnabled,
  ]);

  const applyPreset = useCallback((mode: FontScalingMode) => {
    const preset = BALLOON_FONT_PRESETS[mode];
    if (!preset) return;
    setProfile(prev => ({
      ...prev,
      scalingMode: preset.scalingMode,
      minFontSizePx: preset.minFontSizePx,
      maxFontSizePx: preset.maxFontSizePx,
      targetDensityRatio: preset.targetDensityRatio,
      isFuriganaPreserved: preset.isFuriganaPreserved,
      updatedAt: Date.now(),
    }));
  }, []);

  return {
    isHUDVisible,
    setIsHUDVisible,
    toggleHUD,
    profile,
    setProfile,
    result,
    applyPreset,
  };
}
