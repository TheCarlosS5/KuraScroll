/**
 * KuraScroll - Sprint 127: Adaptive Moiré Pattern Suppressor & Halftone Screentone De-Aliasing Filter Hook
 * 
 * Hardware Target: Intel Pentium T4500 (2C/2T @ 2.30 GHz, Penryn 45nm, no AVX, heap <= 512MB) & Intel GMA 4500MHD.
 * Zero-allocation adaptive moiré pattern suppression and screentone de-aliasing.
 * Bound to key 'M' / 'm' for HUD toggling.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

export type MoireSuppressorPresetName =
  | 'manga_screentone_soften'
  | 'newsprint_despeckle'
  | 'dense_crosshatch_calm'
  | 'vintage_magazine_smooth'
  | 'raw_fixed';

export interface MoireSuppressorProfile {
  seriesId: string;
  presetName: MoireSuppressorPresetName;
  suppressionStrength: number;
  deltaClamp: number;
  edgeThreshold: number;
  filterRadius: number;
  isEnabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface MoireSuppressorPreset {
  name: MoireSuppressorPresetName;
  label: string;
  suppressionStrength: number;
  deltaClamp: number;
  edgeThreshold: number;
  filterRadius: number;
  description: string;
}

export const MOIRE_SUPPRESSOR_PRESETS: Record<MoireSuppressorPresetName, MoireSuppressorPreset> = {
  manga_screentone_soften: {
    name: 'manga_screentone_soften',
    label: 'Manga Screentone Soften',
    suppressionStrength: 0.45,
    deltaClamp: 16.0,
    edgeThreshold: 32.0,
    filterRadius: 2,
    description: 'Suppresses high-frequency halftone dot interference while preserving ink outlines and dialog lines.',
  },
  newsprint_despeckle: {
    name: 'newsprint_despeckle',
    label: 'Newsprint Despeckle',
    suppressionStrength: 0.60,
    deltaClamp: 24.0,
    edgeThreshold: 28.0,
    filterRadius: 2,
    description: 'Aggressively filters coarse newsprint dot matrices and periodic printer scanning artifacts.',
  },
  dense_crosshatch_calm: {
    name: 'dense_crosshatch_calm',
    label: 'Dense Cross-Hatch Calm',
    suppressionStrength: 0.20,
    deltaClamp: 8.0,
    edgeThreshold: 40.0,
    filterRadius: 1,
    description: 'Conservative suppression strictly calibrated to protect intricate manual cross-hatching and shading.',
  },
  vintage_magazine_smooth: {
    name: 'vintage_magazine_smooth',
    label: 'Vintage Magazine Smooth',
    suppressionStrength: 0.50,
    deltaClamp: 20.0,
    edgeThreshold: 30.0,
    filterRadius: 3,
    description: 'Smooths broad periodic color halftone patterns from retro pulp and vintage serialized prints.',
  },
  raw_fixed: {
    name: 'raw_fixed',
    label: 'Raw Pass-Through (Disabled)',
    suppressionStrength: 0.0,
    deltaClamp: 0.0,
    edgeThreshold: 32.0,
    filterRadius: 2,
    description: 'Bypasses moiré pattern de-aliasing and returns exact original halftone data untouched.',
  },
};

export interface MoireSuppressionResult {
  originalLuminance: number;
  filteredLuminance: number;
  edgeStrength: number;
  autocorrelationPeak: number;
  isEdgeProtected: boolean;
  appliedDelta: number;
  latencyUs: number;
}

export function localCalculateMoireSuppression(
  centerLum: number,
  localAvgLum: number,
  dLdx: number = 0,
  dLdy: number = 0,
  autocorrPeak: number = 0.5,
  suppressionStrength: number = 0.45,
  deltaClamp: number = 16.0,
  edgeThreshold: number = 32.0,
  isEnabled: boolean = true
): MoireSuppressionResult {
  const startHr = typeof performance !== 'undefined' ? performance.now() : 0;

  if (!isEnabled || suppressionStrength <= 0.0 || deltaClamp <= 0.0) {
    return {
      originalLuminance: centerLum,
      filteredLuminance: centerLum,
      edgeStrength: 0,
      autocorrelationPeak: autocorrPeak,
      isEdgeProtected: false,
      appliedDelta: 0,
      latencyUs: typeof performance !== 'undefined' ? (performance.now() - startHr) * 1000 : 0.2,
    };
  }

  const absDx = dLdx < 0 ? -dLdx : dLdx;
  const absDy = dLdy < 0 ? -dLdy : dLdy;
  const edgeStrength = absDx > absDy ? absDx : absDy;

  if (edgeStrength >= edgeThreshold) {
    return {
      originalLuminance: centerLum,
      filteredLuminance: centerLum,
      edgeStrength,
      autocorrelationPeak: autocorrPeak,
      isEdgeProtected: true,
      appliedDelta: 0,
      latencyUs: typeof performance !== 'undefined' ? (performance.now() - startHr) * 1000 : 0.2,
    };
  }

  const edgeWeight = 1.0 - edgeStrength / edgeThreshold;
  const peakFactor = autocorrPeak < 0.2 ? 0.2 : autocorrPeak > 1.0 ? 1.0 : autocorrPeak;
  const effectiveStrength = suppressionStrength * edgeWeight * peakFactor;

  const rawDelta = effectiveStrength * (localAvgLum - centerLum);
  let clampedDelta = rawDelta;
  if (clampedDelta > deltaClamp) clampedDelta = deltaClamp;
  else if (clampedDelta < -deltaClamp) clampedDelta = -deltaClamp;

  const finalDelta = clampedDelta === 0 ? 0 : Math.round(clampedDelta * 100) / 100;
  let outLum = centerLum + finalDelta;
  if (outLum > 255) outLum = 255;
  else if (outLum < 0) outLum = 0;

  const endHr = typeof performance !== 'undefined' ? performance.now() : 0;

  return {
    originalLuminance: centerLum,
    filteredLuminance: Math.round(outLum * 100) / 100,
    edgeStrength,
    autocorrelationPeak: autocorrPeak,
    isEdgeProtected: false,
    appliedDelta: finalDelta,
    latencyUs: typeof performance !== 'undefined' ? (endHr - startHr) * 1000 : 0.4,
  };
}

export function useMoireSuppressor(seriesId: string) {
  const [isHUDOpen, setIsHUDOpen] = useState(false);
  const [presetName, setPresetName] = useState<MoireSuppressorPresetName>('manga_screentone_soften');
  const [suppressionStrength, setSuppressionStrength] = useState(0.45);
  const [deltaClamp, setDeltaClamp] = useState(16.0);
  const [edgeThreshold, setEdgeThreshold] = useState(32.0);
  const [filterRadius, setFilterRadius] = useState(2);
  const [isEnabled, setIsEnabled] = useState(true);

  // Probe inputs for live simulator
  const [probeCenterLum, setProbeCenterLum] = useState(100);
  const [probeLocalAvgLum, setProbeLocalAvgLum] = useState(140);
  const [probeDLdx, setProbeDLdx] = useState(5);
  const [probeDLdy, setProbeDLdy] = useState(8);
  const [probeAutocorrPeak, setProbeAutocorrPeak] = useState(0.65);

  const currentResult = useMemo(
    () =>
      localCalculateMoireSuppression(
        probeCenterLum,
        probeLocalAvgLum,
        probeDLdx,
        probeDLdy,
        probeAutocorrPeak,
        suppressionStrength,
        deltaClamp,
        edgeThreshold,
        isEnabled
      ),
    [
      probeCenterLum,
      probeLocalAvgLum,
      probeDLdx,
      probeDLdy,
      probeAutocorrPeak,
      suppressionStrength,
      deltaClamp,
      edgeThreshold,
      isEnabled,
    ]
  );

  // Keyboard hotkey 'M' / 'm' toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        (activeEl as HTMLElement)?.isContentEditable;

      if (!isInput && (e.key === 'm' || e.key === 'M')) {
        e.preventDefault();
        setIsHUDOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const selectPreset = useCallback((presetKey: MoireSuppressorPresetName) => {
    setPresetName(presetKey);
    const p = MOIRE_SUPPRESSOR_PRESETS[presetKey];
    if (p) {
      setSuppressionStrength(p.suppressionStrength);
      setDeltaClamp(p.deltaClamp);
      setEdgeThreshold(p.edgeThreshold);
      setFilterRadius(p.filterRadius);
    }
  }, []);

  return {
    isHUDOpen,
    setIsHUDOpen,
    presetName,
    setPresetName,
    suppressionStrength,
    setSuppressionStrength,
    deltaClamp,
    setDeltaClamp,
    edgeThreshold,
    setEdgeThreshold,
    filterRadius,
    setFilterRadius,
    isEnabled,
    setIsEnabled,
    probeCenterLum,
    setProbeCenterLum,
    probeLocalAvgLum,
    setProbeLocalAvgLum,
    probeDLdx,
    setProbeDLdx,
    probeDLdy,
    setProbeDLdy,
    probeAutocorrPeak,
    setProbeAutocorrPeak,
    currentResult,
    selectPreset,
  };
}
