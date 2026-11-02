/**
 * KuraScroll - Sprint 103: Dynamic Contrast Tone-Mapping & Halftone Ink Bleed Compensator Hook
 * 
 * Hardware-tuned for Intel Pentium T4500 (2C/2T @ 2.3GHz, Penryn 45nm, no AVX) & Intel GMA 4500MHD.
 * Provides real-time parametric luminance transfer calculation to prevent halftone screentone dot merging.
 * Bound to key 'I' for HUD toggling.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

export type CompensationMode = 'vintage_newsprint' | 'deep_black_preservation' | 'halftone_clarity' | 'custom';

export interface InkBleedProfile {
  seriesId: string;
  compensationMode: CompensationMode;
  blackPointLift: number;
  whitePointCompression: number;
  gammaExponent: number;
  inkBleedThreshold: number;
  isEnabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface InkBleedCompensationResult {
  compensationMode: CompensationMode;
  effectiveGamma: number;
  contrastMultiplier: number;
  brightnessOffset: number;
  svgFilterSlope: number;
  svgFilterIntercept: number;
  cssFilterString: string;
  latencyUs: number;
}

export const INK_BLEED_PRESETS: Record<CompensationMode, {
  name: CompensationMode;
  compensationMode: CompensationMode;
  label: string;
  blackPointLift: number;
  whitePointCompression: number;
  gammaExponent: number;
  inkBleedThreshold: number;
  description: string;
}> = {
  vintage_newsprint: {
    name: 'vintage_newsprint',
    compensationMode: 'vintage_newsprint',
    label: 'Vintage Newsprint (Standard Retro Scan)',
    blackPointLift: 0.08,
    whitePointCompression: 0.95,
    gammaExponent: 1.15,
    inkBleedThreshold: 0.18,
    description: 'Lifts muddy blacks by 8% to restore fine screentones on scans printed on cheap pulp paper',
  },
  deep_black_preservation: {
    name: 'deep_black_preservation',
    compensationMode: 'deep_black_preservation',
    label: 'Deep Black Preservation (High-Contrast Noir)',
    blackPointLift: 0.03,
    whitePointCompression: 0.98,
    gammaExponent: 1.05,
    inkBleedThreshold: 0.12,
    description: 'Maintains inky deep blacks with subtle highlight compression for modern digital releases',
  },
  halftone_clarity: {
    name: 'halftone_clarity',
    compensationMode: 'halftone_clarity',
    label: 'Halftone Clarity (Dense Screentone Separation)',
    blackPointLift: 0.12,
    whitePointCompression: 0.92,
    gammaExponent: 1.25,
    inkBleedThreshold: 0.25,
    description: 'Aggressively opens up dark midtones to prevent dot-matrix pattern merging in shonen action scans',
  },
  custom: {
    name: 'custom',
    compensationMode: 'custom',
    label: 'Custom Tone-Mapping',
    blackPointLift: 0.08,
    whitePointCompression: 0.95,
    gammaExponent: 1.15,
    inkBleedThreshold: 0.18,
    description: 'User-defined parametric luminance curve tailored to specific scan releases',
  },
};

export function localCalculateInkBleedCompensation(
  blackPointLift: number = 0.08,
  whitePointCompression: number = 0.95,
  gammaExponent: number = 1.15,
  inkBleedThreshold: number = 0.18,
  ambientLux: number = 120,
  mode: CompensationMode = 'vintage_newsprint',
  isEnabled: boolean = true
): InkBleedCompensationResult {
  const start = performance.now();

  const bLift = Math.max(0.00, Math.min(0.30, blackPointLift));
  const wComp = Math.max(0.70, Math.min(1.00, whitePointCompression));
  const gamma = Math.max(0.50, Math.min(2.50, gammaExponent));
  const threshold = Math.max(0.05, Math.min(0.50, inkBleedThreshold));

  if (!isEnabled) {
    return {
      compensationMode: mode,
      effectiveGamma: 1.0,
      contrastMultiplier: 100,
      brightnessOffset: 100,
      svgFilterSlope: 1.0,
      svgFilterIntercept: 0.0,
      cssFilterString: 'none',
      latencyUs: (performance.now() - start) * 1000,
    };
  }

  const slope = Math.max(0.10, Math.min(1.50, wComp - bLift));
  const intercept = bLift;

  const luxAdjustment = ambientLux > 200 ? 0.05 : (ambientLux < 50 ? -0.05 : 0.0);
  const effectiveGamma = Math.round(
    (gamma * (1.0 + 0.15 * (threshold - 0.18)) + luxAdjustment) * 100
  ) / 100;

  const contrastMultiplier = Math.round(slope * 100);
  const brightnessOffset = Math.round((1.0 + intercept * 0.6) * 100);

  const cssFilterString = `contrast(${contrastMultiplier}%) brightness(${brightnessOffset}%)`;
  const latencyUs = (performance.now() - start) * 1000;

  return {
    compensationMode: mode,
    effectiveGamma,
    contrastMultiplier,
    brightnessOffset,
    svgFilterSlope: Math.round(slope * 1000) / 1000,
    svgFilterIntercept: Math.round(intercept * 1000) / 1000,
    cssFilterString,
    latencyUs,
  };
}

export interface UseInkBleedProps {
  seriesId?: string;
  initialMode?: CompensationMode;
  ambientLux?: number;
}

export interface UseInkBleedReturn {
  isHUDVisible: boolean;
  setIsHUDVisible: (visible: boolean | ((prev: boolean) => boolean)) => void;
  toggleHUD: () => void;
  profile: InkBleedProfile;
  setProfile: React.Dispatch<React.SetStateAction<InkBleedProfile>>;
  result: InkBleedCompensationResult;
  applyPreset: (mode: CompensationMode) => void;
}

export function useInkBleed(props: UseInkBleedProps = {}): UseInkBleedReturn {
  const {
    seriesId = 'default-series',
    initialMode = 'vintage_newsprint',
    ambientLux = 120,
  } = props;

  const [isHUDVisible, setIsHUDVisible] = useState(false);

  const initialProfile = useMemo<InkBleedProfile>(() => {
    const preset = INK_BLEED_PRESETS[initialMode] || INK_BLEED_PRESETS.vintage_newsprint;
    return {
      seriesId,
      compensationMode: preset.compensationMode,
      blackPointLift: preset.blackPointLift,
      whitePointCompression: preset.whitePointCompression,
      gammaExponent: preset.gammaExponent,
      inkBleedThreshold: preset.inkBleedThreshold,
      isEnabled: true,
      createdAt: 0,
      updatedAt: 0,
    };
  }, [seriesId, initialMode]);

  const [profile, setProfile] = useState<InkBleedProfile>(initialProfile);

  const toggleHUD = useCallback(() => {
    setIsHUDVisible(prev => !prev);
  }, []);

  // Keyboard shortcut listener: 'I' / 'i'
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
        return;
      }
      if (event.key === 'i' || event.key === 'I') {
        event.preventDefault();
        toggleHUD();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleHUD]);

  // Compute tone-mapping and ink bleed compensation result
  const result = useMemo(() => {
    return localCalculateInkBleedCompensation(
      profile.blackPointLift,
      profile.whitePointCompression,
      profile.gammaExponent,
      profile.inkBleedThreshold,
      ambientLux,
      profile.compensationMode,
      profile.isEnabled
    );
  }, [
    profile.blackPointLift,
    profile.whitePointCompression,
    profile.gammaExponent,
    profile.inkBleedThreshold,
    ambientLux,
    profile.compensationMode,
    profile.isEnabled,
  ]);

  const applyPreset = useCallback((mode: CompensationMode) => {
    const preset = INK_BLEED_PRESETS[mode];
    if (!preset) return;
    setProfile(prev => ({
      ...prev,
      compensationMode: preset.compensationMode,
      blackPointLift: preset.blackPointLift,
      whitePointCompression: preset.whitePointCompression,
      gammaExponent: preset.gammaExponent,
      inkBleedThreshold: preset.inkBleedThreshold,
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
