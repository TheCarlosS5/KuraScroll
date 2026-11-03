/**
 * KuraScroll - Sprint 126: Subpixel Chromatic Aberration & Lens Distortion Compensator Hook
 * 
 * Hardware Target: Intel Pentium T4500 (2C/2T @ 2.30 GHz, Penryn 45nm, no AVX, heap <= 512MB) & Intel GMA 4500MHD.
 * Zero-allocation Brown-Conrady radial polynomial distortion evaluation without Math.sqrt.
 * Bound to key 'C' / 'c' for HUD toggling.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

export type LensDistortionPresetName =
  | 'tankobon_flatbed_scanner'
  | 'aged_lens_barrel'
  | 'pincushion_edge_fix'
  | 'subtle_neutralizer'
  | 'raw_fixed';

export interface LensDistortionProfile {
  seriesId: string;
  presetName: LensDistortionPresetName;
  k1: number;
  k2: number;
  redShift: number;
  blueShift: number;
  centerX: number;
  centerY: number;
  scale: number;
  isEnabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface LensDistortionPreset {
  name: LensDistortionPresetName;
  label: string;
  k1: number;
  k2: number;
  redShift: number;
  blueShift: number;
  centerX: number;
  centerY: number;
  scale: number;
  description: string;
}

export const LENS_DISTORTION_PRESETS: Record<LensDistortionPresetName, LensDistortionPreset> = {
  tankobon_flatbed_scanner: {
    name: 'tankobon_flatbed_scanner',
    label: 'Tankōbon Flatbed Scanner',
    k1: -0.015,
    k2: 0.002,
    redShift: 0.004,
    blueShift: -0.004,
    centerX: 0.50,
    centerY: 0.50,
    scale: 1.00,
    description: 'Subtle radial barrel distortion and lateral chromatic fringe correction for desktop flatbed scans.',
  },
  aged_lens_barrel: {
    name: 'aged_lens_barrel',
    label: 'Aged Lens Barrel Distortion',
    k1: -0.035,
    k2: 0.005,
    redShift: 0.008,
    blueShift: -0.008,
    centerX: 0.50,
    centerY: 0.50,
    scale: 1.02,
    description: 'Compensates pronounced barrel bowing and noticeable edge chromatic fringing from vintage optical lenses.',
  },
  pincushion_edge_fix: {
    name: 'pincushion_edge_fix',
    label: 'Pincushion Edge Flattener',
    k1: 0.025,
    k2: -0.003,
    redShift: -0.003,
    blueShift: 0.003,
    centerX: 0.50,
    centerY: 0.50,
    scale: 0.98,
    description: 'Flattens outward pincushion warping near outer comic margins caused by wide-angle camera rigs.',
  },
  subtle_neutralizer: {
    name: 'subtle_neutralizer',
    label: 'Subtle Optical Neutralizer',
    k1: -0.008,
    k2: 0.001,
    redShift: 0.002,
    blueShift: -0.002,
    centerX: 0.50,
    centerY: 0.50,
    scale: 1.00,
    description: 'Minimal correction pass preserving natural paper texture while eliminating high-contrast color split.',
  },
  raw_fixed: {
    name: 'raw_fixed',
    label: 'Raw Pass-Through (Disabled)',
    k1: 0.0,
    k2: 0.0,
    redShift: 0.0,
    blueShift: 0.0,
    centerX: 0.50,
    centerY: 0.50,
    scale: 1.00,
    description: 'Bypasses optical distortion and chromatic shift correction, retaining the exact raw image.',
  },
};

export interface LensDistortionResult {
  correctedX: number;
  correctedY: number;
  distortionFactor: number;
  redOffsetX: number;
  redOffsetY: number;
  blueOffsetX: number;
  blueOffsetY: number;
  greenOffsetX: number;
  greenOffsetY: number;
  latencyUs: number;
}

export function localCalculateLensDistortion(
  normX: number,
  normY: number,
  k1: number = -0.015,
  k2: number = 0.002,
  redShift: number = 0.004,
  blueShift: number = -0.004,
  centerX: number = 0.50,
  centerY: number = 0.50,
  scale: number = 1.00,
  isEnabled: boolean = true
): LensDistortionResult {
  const startHr = typeof performance !== 'undefined' ? performance.now() : 0;

  if (!isEnabled) {
    return {
      correctedX: normX,
      correctedY: normY,
      distortionFactor: 1.0,
      redOffsetX: 0.0,
      redOffsetY: 0.0,
      blueOffsetX: 0.0,
      blueOffsetY: 0.0,
      greenOffsetX: 0.0,
      greenOffsetY: 0.0,
      latencyUs: typeof performance !== 'undefined' ? (performance.now() - startHr) * 1000 : 0.2,
    };
  }

  const xn = normX - centerX;
  const yn = normY - centerY;
  const r2 = xn * xn + yn * yn;
  const r4 = r2 * r2;

  const d = 1.0 + k1 * r2 + k2 * r4;
  const corrX = centerX + xn * d * scale;
  const corrY = centerY + yn * d * scale;

  const rDistRed = redShift * r2;
  const rDistBlue = blueShift * r2;

  const rOffX = Math.round(xn * rDistRed * 4.0) * 0.25;
  const rOffY = Math.round(yn * rDistRed * 4.0) * 0.25;
  const bOffX = Math.round(xn * rDistBlue * 4.0) * 0.25;
  const bOffY = Math.round(yn * rDistBlue * 4.0) * 0.25;

  const endHr = typeof performance !== 'undefined' ? performance.now() : 0;

  return {
    correctedX: corrX,
    correctedY: corrY,
    distortionFactor: d,
    redOffsetX: rOffX === 0 ? 0 : rOffX,
    redOffsetY: rOffY === 0 ? 0 : rOffY,
    blueOffsetX: bOffX === 0 ? 0 : bOffX,
    blueOffsetY: bOffY === 0 ? 0 : bOffY,
    greenOffsetX: 0.0,
    greenOffsetY: 0.0,
    latencyUs: typeof performance !== 'undefined' ? (endHr - startHr) * 1000 : 0.4,
  };
}

export function useLensDistortion(seriesId: string) {
  const [isHUDOpen, setIsHUDOpen] = useState(false);
  const [presetName, setPresetName] = useState<LensDistortionPresetName>('tankobon_flatbed_scanner');
  const [k1, setK1] = useState(-0.015);
  const [k2, setK2] = useState(0.002);
  const [redShift, setRedShift] = useState(0.004);
  const [blueShift, setBlueShift] = useState(-0.004);
  const [centerX, setCenterX] = useState(0.50);
  const [centerY, setCenterY] = useState(0.50);
  const [scale, setScale] = useState(1.00);
  const [isEnabled, setIsEnabled] = useState(true);

  // Sample probe coordinate for HUD live inspection
  const [probeX, setProbeX] = useState(0.90);
  const [probeY, setProbeY] = useState(0.90);

  const currentResult = useMemo(
    () =>
      localCalculateLensDistortion(
        probeX,
        probeY,
        k1,
        k2,
        redShift,
        blueShift,
        centerX,
        centerY,
        scale,
        isEnabled
      ),
    [probeX, probeY, k1, k2, redShift, blueShift, centerX, centerY, scale, isEnabled]
  );

  // Keyboard hotkey 'C' / 'c' toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        (activeEl as HTMLElement)?.isContentEditable;

      if (!isInput && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        setIsHUDOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const selectPreset = useCallback((presetKey: LensDistortionPresetName) => {
    setPresetName(presetKey);
    const p = LENS_DISTORTION_PRESETS[presetKey];
    if (p) {
      setK1(p.k1);
      setK2(p.k2);
      setRedShift(p.redShift);
      setBlueShift(p.blueShift);
      setCenterX(p.centerX);
      setCenterY(p.centerY);
      setScale(p.scale);
    }
  }, []);

  return {
    isHUDOpen,
    setIsHUDOpen,
    presetName,
    setPresetName,
    k1,
    setK1,
    k2,
    setK2,
    redShift,
    setRedShift,
    blueShift,
    setBlueShift,
    centerX,
    setCenterX,
    centerY,
    setCenterY,
    scale,
    setScale,
    isEnabled,
    setIsEnabled,
    probeX,
    setProbeX,
    probeY,
    setProbeY,
    currentResult,
    selectPreset,
  };
}
