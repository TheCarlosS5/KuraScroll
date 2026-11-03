/**
 * KuraScroll - Sprint 122: Contrast-Adaptive Subpixel Unsharp Mask & Micro-Sharpening Synthesizer Hook
 * 
 * Hardware Target: Intel Pentium T4500 (2C/2T @ 2.30 GHz, Penryn 45nm, no AVX, heap <= 512MB) & Intel GMA 4500MHD.
 * Pure zero-allocation 5-point cross stencil contrast-adaptive unsharp mask (CAS/USM).
 * Bound to key 'U' / 'u' for HUD toggling.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

export type UnsharpMaskPresetName =
  | 'webtoon_ribbon_crisp'
  | 'tankobon_ink_accent'
  | 'vintage_grain_pass'
  | 'furigana_edge_guard'
  | 'raw_neutral';

export interface UnsharpMaskProfile {
  seriesId: string;
  presetName: UnsharpMaskPresetName;
  sharpness: number;
  edgeThreshold: number;
  haloClamp: number;
  maxWeight: number;
  isEnabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface UnsharpMaskPreset {
  name: UnsharpMaskPresetName;
  label: string;
  sharpness: number;
  edgeThreshold: number;
  haloClamp: number;
  maxWeight: number;
  description: string;
}

export const UNSHARP_MASK_PRESETS: Record<UnsharpMaskPresetName, UnsharpMaskPreset> = {
  webtoon_ribbon_crisp: {
    name: 'webtoon_ribbon_crisp',
    label: 'Webtoon Ribbon Crisp (Adaptive USM)',
    sharpness: 0.85,
    edgeThreshold: 12.0,
    haloClamp: 0.05,
    maxWeight: 0.35,
    description: 'High-clarity micro-sharpening eliminating compression blur on tall manhwa strips.',
  },
  tankobon_ink_accent: {
    name: 'tankobon_ink_accent',
    label: 'Tankobon Ink Accent',
    sharpness: 0.65,
    edgeThreshold: 18.0,
    haloClamp: 0.08,
    maxWeight: 0.28,
    description: 'Deepened ink boundaries and linework definition for print tankobon scans.',
  },
  vintage_grain_pass: {
    name: 'vintage_grain_pass',
    label: 'Vintage Grain Pass (Light)',
    sharpness: 0.40,
    edgeThreshold: 25.0,
    haloClamp: 0.12,
    maxWeight: 0.20,
    description: 'Subtle high-frequency edge pass preserving original halftones without grain harshness.',
  },
  furigana_edge_guard: {
    name: 'furigana_edge_guard',
    label: 'Furigana Edge Guard (Precision)',
    sharpness: 1.00,
    edgeThreshold: 8.0,
    haloClamp: 0.02,
    maxWeight: 0.40,
    description: 'Ultra-fine boundary sharpening for tiny ruby furigana characters and subtle speech.',
  },
  raw_neutral: {
    name: 'raw_neutral',
    label: 'Raw Pass-Through (Neutral)',
    sharpness: 0.00,
    edgeThreshold: 0.0,
    haloClamp: 0.00,
    maxWeight: 0.00,
    description: 'Bypasses sharpening returning original pixel value without modification.',
  },
};

export interface UnsharpMaskResult {
  outValue: number;
  weight: number;
  contrast: number;
  haloSuppressed: boolean;
  latencyUs: number;
}

export function localCalculateUnsharpMask(
  center: number,
  north: number,
  south: number,
  east: number,
  west: number,
  sharpness: number = 0.85,
  edgeThreshold: number = 12.0,
  haloClamp: number = 0.05,
  maxWeight: number = 0.35,
  isEnabled: boolean = true
): UnsharpMaskResult {
  const startHr = typeof performance !== 'undefined' ? performance.now() : 0;

  const c = Math.max(0, Math.min(255, center));

  if (!isEnabled || sharpness <= 0.001) {
    return {
      outValue: c,
      weight: 0.0,
      contrast: 0.0,
      haloSuppressed: false,
      latencyUs: typeof performance !== 'undefined' ? (performance.now() - startHr) * 1000 : 0.2,
    };
  }

  const n = Math.max(0, Math.min(255, north));
  const s = Math.max(0, Math.min(255, south));
  const e = Math.max(0, Math.min(255, east));
  const w = Math.max(0, Math.min(255, west));

  let minVal = c;
  if (n < minVal) minVal = n;
  if (s < minVal) minVal = s;
  if (e < minVal) minVal = e;
  if (w < minVal) minVal = w;

  let maxVal = c;
  if (n > maxVal) maxVal = n;
  if (s > maxVal) maxVal = s;
  if (e > maxVal) maxVal = e;
  if (w > maxVal) maxVal = w;

  const contrast = maxVal - minVal;

  if (contrast < edgeThreshold) {
    return {
      outValue: c,
      weight: 0.0,
      contrast,
      haloSuppressed: false,
      latencyUs: typeof performance !== 'undefined' ? (performance.now() - startHr) * 1000 : 0.2,
    };
  }

  const normContrast = Math.min(1.0, contrast / 255.0);
  const rawWeight = sharpness * (1.0 - normContrast * 0.5);
  const weight = Math.max(0.0, Math.min(maxWeight, rawWeight));

  const blur = (n + s + e + w) * 0.25;
  const unsharp = c + weight * (c - blur);

  const lowerBound = Math.max(0, minVal * (1.0 - haloClamp));
  const upperBound = Math.min(255, maxVal * (1.0 + haloClamp));

  let finalValue = Math.round(unsharp);
  let haloSuppressed = false;
  if (finalValue < lowerBound) {
    finalValue = Math.round(lowerBound);
    haloSuppressed = true;
  } else if (finalValue > upperBound) {
    finalValue = Math.round(upperBound);
    haloSuppressed = true;
  }
  finalValue = Math.max(0, Math.min(255, finalValue));

  const endHr = typeof performance !== 'undefined' ? performance.now() : 0;

  return {
    outValue: finalValue,
    weight,
    contrast,
    haloSuppressed,
    latencyUs: typeof performance !== 'undefined' ? (endHr - startHr) * 1000 : 0.2,
  };
}

export function useUnsharpMask(seriesId: string) {
  const [isHUDOpen, setIsHUDOpen] = useState(false);
  const [presetName, setPresetName] = useState<UnsharpMaskPresetName>('webtoon_ribbon_crisp');
  const [sharpness, setSharpness] = useState(0.85);
  const [edgeThreshold, setEdgeThreshold] = useState(12.0);
  const [haloClamp, setHaloClamp] = useState(0.05);
  const [maxWeight, setMaxWeight] = useState(0.35);
  const [isEnabled, setIsEnabled] = useState(true);

  // 5-point stencil sample state
  const [sampleStencil, setSampleStencil] = useState({
    center: 45,
    north: 180,
    south: 180,
    east: 45,
    west: 45,
  });

  const currentResult = useMemo(
    () =>
      localCalculateUnsharpMask(
        sampleStencil.center,
        sampleStencil.north,
        sampleStencil.south,
        sampleStencil.east,
        sampleStencil.west,
        sharpness,
        edgeThreshold,
        haloClamp,
        maxWeight,
        isEnabled
      ),
    [
      sampleStencil,
      sharpness,
      edgeThreshold,
      haloClamp,
      maxWeight,
      isEnabled,
    ]
  );

  // Keyboard hotkey 'U' / 'u' toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        (activeEl as HTMLElement)?.isContentEditable;

      if (!isInput && (e.key === 'u' || e.key === 'U')) {
        e.preventDefault();
        setIsHUDOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const selectPreset = useCallback((presetKey: UnsharpMaskPresetName) => {
    setPresetName(presetKey);
    const p = UNSHARP_MASK_PRESETS[presetKey];
    if (p) {
      setSharpness(p.sharpness);
      setEdgeThreshold(p.edgeThreshold);
      setHaloClamp(p.haloClamp);
      setMaxWeight(p.maxWeight);
    }
  }, []);

  return {
    isHUDOpen,
    setIsHUDOpen,
    presetName,
    setPresetName,
    sharpness,
    setSharpness,
    edgeThreshold,
    setEdgeThreshold,
    haloClamp,
    setHaloClamp,
    maxWeight,
    setMaxWeight,
    isEnabled,
    setIsEnabled,
    sampleStencil,
    setSampleStencil,
    currentResult,
    selectPreset,
  };
}
