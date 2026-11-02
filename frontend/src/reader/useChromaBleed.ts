/**
 * KuraScroll - Sprint 110: Perceptual Ambient Chroma Bleed & Color-Temperature Adaptive Edge Backlight Hook
 * 
 * Hardware Target: Intel Pentium T4500 (2C/2T @ 2.30 GHz, Penryn 45nm, no AVX, heap <= 512MB) & Intel GMA 4500MHD.
 * Synthesizes zero-allocation perceptual ambient color temperature edge backlights.
 * Bound to key 'Z' / 'z' for HUD toggling.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

export type ColorMode =
  | 'monochrome_bw'
  | 'sepia_vintage'
  | 'night_crimson'
  | 'cyberpunk_neon'
  | 'oled_pitch_black'
  | 'custom';

export interface ChromaBleedProfile {
  seriesId: string;
  colorMode: ColorMode;
  colorTemperatureK: number;
  bleedSpreadPx: number;
  ambientIntensityPct: number;
  edgeFalloffExponent: number;
  isEnabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ChromaBleedResult {
  colorMode: ColorMode;
  colorTemperatureK: number;
  rgbColor: { r: number; g: number; b: number };
  hexColor: string;
  perceptualLuminance: number;
  bleedSpreadPx: number;
  ambientIntensityPct: number;
  topGradient: string;
  bottomGradient: string;
  leftGradient: string;
  rightGradient: string;
  perimeterShadow: string;
  latencyUs: number;
}

export interface ChromaBleedPreset {
  name: ColorMode;
  colorMode: ColorMode;
  label: string;
  colorTemperatureK: number;
  bleedSpreadPx: number;
  ambientIntensityPct: number;
  edgeFalloffExponent: number;
  description: string;
}

export const CHROMA_BLEED_PRESETS: Record<ColorMode, ChromaBleedPreset> = {
  monochrome_bw: {
    name: 'monochrome_bw',
    colorMode: 'monochrome_bw',
    label: 'Standard Manga Cool Neutral (6500 K)',
    colorTemperatureK: 6500,
    bleedSpreadPx: 24,
    ambientIntensityPct: 35,
    edgeFalloffExponent: 2.2,
    description: 'Clean daylight neutral halo for classic black & white manga panels',
  },
  sepia_vintage: {
    name: 'sepia_vintage',
    colorMode: 'sepia_vintage',
    label: 'Vintage Sepia & Newsprint (3200 K)',
    colorTemperatureK: 3200,
    bleedSpreadPx: 32,
    ambientIntensityPct: 45,
    edgeFalloffExponent: 2.0,
    description: 'Warm cream-amber glow mimicking vintage retro print lighting',
  },
  night_crimson: {
    name: 'night_crimson',
    colorMode: 'night_crimson',
    label: 'Night Reading Anti-Blue Crimson (2200 K)',
    colorTemperatureK: 2200,
    bleedSpreadPx: 40,
    ambientIntensityPct: 30,
    edgeFalloffExponent: 1.8,
    description: 'Deep amber-crimson low-light projection to protect circadian rhythm',
  },
  cyberpunk_neon: {
    name: 'cyberpunk_neon',
    colorMode: 'cyberpunk_neon',
    label: 'High-Saturation Cyberpunk Neon (8000 K)',
    colorTemperatureK: 8000,
    bleedSpreadPx: 48,
    ambientIntensityPct: 60,
    edgeFalloffExponent: 1.5,
    description: 'Vivid cold cyan perimeter projection for modern sci-fi & action webtoons',
  },
  oled_pitch_black: {
    name: 'oled_pitch_black',
    colorMode: 'oled_pitch_black',
    label: 'OLED Zero-Bleed Pitch Black (0 K)',
    colorTemperatureK: 6500,
    bleedSpreadPx: 8,
    ambientIntensityPct: 0,
    edgeFalloffExponent: 3.0,
    description: 'Zero ambient bleed with 100% border pixel extinction for maximum contrast',
  },
  custom: {
    name: 'custom',
    colorMode: 'custom',
    label: 'Custom Reader Ambient Profile',
    colorTemperatureK: 5000,
    bleedSpreadPx: 28,
    ambientIntensityPct: 40,
    edgeFalloffExponent: 2.0,
    description: 'User-configured color temperature, spread width, and intensity',
  },
};

export function localCalculateChromaBleed(
  colorTemperatureK: number = 6500,
  bleedSpreadPx: number = 24,
  ambientIntensityPct: number = 35,
  edgeFalloffExponent: number = 2.2,
  colorMode: ColorMode = 'monochrome_bw',
  isEnabled: boolean = true
): ChromaBleedResult {
  const start = performance.now();

  const tempK = Math.max(2000, Math.min(9000, colorTemperatureK));
  const spreadPx = Math.max(8, Math.min(64, bleedSpreadPx));
  const intensityPct = Math.max(0, Math.min(100, ambientIntensityPct));
  const falloffExp = Math.max(1.0, Math.min(4.0, edgeFalloffExponent));

  if (!isEnabled || intensityPct === 0) {
    const end = performance.now();
    return {
      colorMode,
      colorTemperatureK: tempK,
      rgbColor: { r: 0, g: 0, b: 0 },
      hexColor: '#000000',
      perceptualLuminance: 0,
      bleedSpreadPx: spreadPx,
      ambientIntensityPct: 0,
      topGradient: 'none',
      bottomGradient: 'none',
      leftGradient: 'none',
      rightGradient: 'none',
      perimeterShadow: 'none',
      latencyUs: (end - start) * 1000.0,
    };
  }

  const t = tempK / 100.0;
  let r = 0;
  let g = 0;
  let b = 0;

  if (t <= 66.0) {
    r = 255;
    g = Math.max(0, Math.min(255, Math.round(99.4708025861 * Math.log(t) - 161.1195681661)));
    b = t <= 19.0
      ? 0
      : Math.max(0, Math.min(255, Math.round(138.5177312231 * Math.log(t - 10.0) - 305.0447927307)));
  } else {
    r = Math.max(0, Math.min(255, Math.round(329.698727446 * Math.pow(t - 60.0, -0.1332047592))));
    g = Math.max(0, Math.min(255, Math.round(288.1221695283 * Math.pow(t - 60.0, -0.0755148492))));
    b = 255;
  }

  const perceptualLuminance = Number((0.299 * r + 0.587 * g + 0.114 * b).toFixed(2));
  const maxAlpha = Number(((intensityPct / 100.0) * 0.45).toFixed(3));
  const midAlpha = Number((maxAlpha * Math.pow(0.5, falloffExp)).toFixed(3));

  const hexColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;

  const topGradient = `linear-gradient(to bottom, rgba(${r}, ${g}, ${b}, ${maxAlpha}) 0%, rgba(${r}, ${g}, ${b}, ${midAlpha}) 60%, rgba(0, 0, 0, 0) 100%)`;
  const bottomGradient = `linear-gradient(to top, rgba(${r}, ${g}, ${b}, ${maxAlpha}) 0%, rgba(${r}, ${g}, ${b}, ${midAlpha}) 60%, rgba(0, 0, 0, 0) 100%)`;
  const leftGradient = `linear-gradient(to right, rgba(${r}, ${g}, ${b}, ${maxAlpha}) 0%, rgba(${r}, ${g}, ${b}, ${midAlpha}) 60%, rgba(0, 0, 0, 0) 100%)`;
  const rightGradient = `linear-gradient(to left, rgba(${r}, ${g}, ${b}, ${maxAlpha}) 0%, rgba(${r}, ${g}, ${b}, ${midAlpha}) 60%, rgba(0, 0, 0, 0) 100%)`;

  const perimeterShadow = `inset 0 0 0 ${spreadPx}px rgba(${r}, ${g}, ${b}, ${midAlpha})`;

  const end = performance.now();
  const latencyUs = (end - start) * 1000.0;

  return {
    colorMode,
    colorTemperatureK: tempK,
    rgbColor: { r, g, b },
    hexColor,
    perceptualLuminance,
    bleedSpreadPx: spreadPx,
    ambientIntensityPct: intensityPct,
    topGradient,
    bottomGradient,
    leftGradient,
    rightGradient,
    perimeterShadow,
    latencyUs,
  };
}

export function useChromaBleed(seriesId: string = 'default-series') {
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [profile, setProfile] = useState<ChromaBleedProfile>({
    seriesId,
    ...CHROMA_BLEED_PRESETS.monochrome_bw,
    isEnabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  // Keyboard shortcut 'Z' / 'z' (Zenith / Chroma Backlight)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || (document.activeElement as HTMLElement)?.isContentEditable) {
        return;
      }

      if (e.key === 'z' || e.key === 'Z') {
        if (!e.ctrlKey && !e.altKey && !e.metaKey) {
          e.preventDefault();
          setIsVisible((prev) => !prev);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const result = useMemo(() => {
    return localCalculateChromaBleed(
      profile.colorTemperatureK,
      profile.bleedSpreadPx,
      profile.ambientIntensityPct,
      profile.edgeFalloffExponent,
      profile.colorMode,
      profile.isEnabled
    );
  }, [
    profile.colorTemperatureK,
    profile.bleedSpreadPx,
    profile.ambientIntensityPct,
    profile.edgeFalloffExponent,
    profile.colorMode,
    profile.isEnabled,
  ]);

  const setPreset = useCallback((presetName: ColorMode) => {
    const preset = CHROMA_BLEED_PRESETS[presetName];
    if (preset) {
      setProfile((prev) => ({
        ...prev,
        colorMode: preset.colorMode,
        colorTemperatureK: preset.colorTemperatureK,
        bleedSpreadPx: preset.bleedSpreadPx,
        ambientIntensityPct: preset.ambientIntensityPct,
        edgeFalloffExponent: preset.edgeFalloffExponent,
        updatedAt: Date.now(),
      }));
    }
  }, []);

  const updateProfile = useCallback((params: Partial<ChromaBleedProfile>) => {
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
    result,
    setPreset,
  };
}
