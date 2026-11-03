/**
 * KuraScroll - Sprint 123: Adaptive Dynamic Range (ADR) Tone Equalizer & Black-Crush Compensator Hook
 * 
 * Hardware Target: Intel Pentium T4500 (2C/2T @ 2.30 GHz, Penryn 45nm, no AVX, heap <= 512MB) & Intel GMA 4500MHD.
 * Pure zero-allocation 3-segment piecewise tone curve for black-crush compensation & dynamic range expansion.
 * Bound to key 'R' / 'r' for HUD toggling.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

export type ADRPresetName =
  | 'berserk_night_recovery'
  | 'shonen_deep_black'
  | 'vintage_newsprint_gamma'
  | 'webtoon_vibrant_range'
  | 'raw_linear';

export interface ADRToneProfile {
  seriesId: string;
  presetName: ADRPresetName;
  shadowLift: number;
  gamma: number;
  shoulderClamp: number;
  whitePoint: number;
  isEnabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ADRTonePreset {
  name: ADRPresetName;
  label: string;
  shadowLift: number;
  gamma: number;
  shoulderClamp: number;
  whitePoint: number;
  description: string;
}

export const ADR_TONE_PRESETS: Record<ADRPresetName, ADRTonePreset> = {
  berserk_night_recovery: {
    name: 'berserk_night_recovery',
    label: 'Berserk Night Recovery (Anti-Black Crush)',
    shadowLift: 0.55,
    gamma: 1.25,
    shoulderClamp: 0.95,
    whitePoint: 1.00,
    description: 'Recovers crushed shadow hatching in dark grimdark panels while preserving deep ink blacks.',
  },
  shonen_deep_black: {
    name: 'shonen_deep_black',
    label: 'Shonen High-Contrast Deep Black',
    shadowLift: 0.20,
    gamma: 1.05,
    shoulderClamp: 1.00,
    whitePoint: 1.00,
    description: 'Punchy shonen dynamics keeping deep silhouettes crisp without gray washing.',
  },
  vintage_newsprint_gamma: {
    name: 'vintage_newsprint_gamma',
    label: 'Vintage Newsprint Compressed Gamma',
    shadowLift: 0.35,
    gamma: 0.90,
    shoulderClamp: 0.92,
    whitePoint: 0.96,
    description: 'Compresses bright highlights and lifts dark screentones mimicking unbleached paper.',
  },
  webtoon_vibrant_range: {
    name: 'webtoon_vibrant_range',
    label: 'Webtoon Vibrant Range Extension',
    shadowLift: 0.40,
    gamma: 1.15,
    shoulderClamp: 1.00,
    whitePoint: 1.00,
    description: 'Smooth dynamic range expansion for colorful webtoon gradients and night cityscapes.',
  },
  raw_linear: {
    name: 'raw_linear',
    label: 'Raw Linear Pass-Through',
    shadowLift: 0.00,
    gamma: 1.00,
    shoulderClamp: 1.00,
    whitePoint: 1.00,
    description: 'Bypasses tone equalization returning unmodified source pixel values.',
  },
};

export interface ADRToneResult {
  outLuminance: number;
  liftDelta: number;
  normalizedIn: number;
  normalizedOut: number;
  latencyUs: number;
}

export function localCalculateADRTone(
  luminance: number,
  shadowLift: number = 0.55,
  gamma: number = 1.25,
  shoulderClamp: number = 0.95,
  whitePoint: number = 1.00,
  isEnabled: boolean = true
): ADRToneResult {
  const startHr = typeof performance !== 'undefined' ? performance.now() : 0;

  const lum = Math.max(0.0, Math.min(255.0, luminance));
  const normIn = lum / 255.0;

  if (!isEnabled) {
    return {
      outLuminance: Math.round(lum),
      liftDelta: 0.0,
      normalizedIn: normIn,
      normalizedOut: normIn,
      latencyUs: typeof performance !== 'undefined' ? (performance.now() - startHr) * 1000 : 0.2,
    };
  }

  // 1. Toe Segment: Smooth Quadratic Shadow Lift
  const clampedLift = Math.max(0.0, Math.min(1.0, shadowLift));
  const liftBonus = clampedLift * normIn * (1.0 - normIn) * (1.0 - normIn);
  const lifted = Math.min(1.0, normIn + liftBonus);

  // 2. Midtone Segment: Gamma Exponent Curve
  const clampedGamma = Math.max(0.2, Math.min(3.0, gamma));
  const gammaAdjusted = Math.pow(lifted, 1.0 / clampedGamma);

  // 3. Shoulder Segment: Highlight Knee Compression & White Point Clamping
  const clampedShoulder = Math.max(0.50, Math.min(1.0, shoulderClamp));
  const clampedWp = Math.max(0.80, Math.min(1.0, whitePoint));
  const normOut = Math.min(clampedWp, gammaAdjusted * clampedShoulder);

  const outLum = Math.max(0, Math.min(255, Math.round(normOut * 255.0)));
  const endHr = typeof performance !== 'undefined' ? performance.now() : 0;

  return {
    outLuminance: outLum,
    liftDelta: outLum - Math.round(lum),
    normalizedIn: normIn,
    normalizedOut: normOut,
    latencyUs: typeof performance !== 'undefined' ? (endHr - startHr) * 1000 : 0.2,
  };
}

export function useADRTone(seriesId: string) {
  const [isHUDOpen, setIsHUDOpen] = useState(false);
  const [presetName, setPresetName] = useState<ADRPresetName>('berserk_night_recovery');
  const [shadowLift, setShadowLift] = useState(0.55);
  const [gamma, setGamma] = useState(1.25);
  const [shoulderClamp, setShoulderClamp] = useState(0.95);
  const [whitePoint, setWhitePoint] = useState(1.00);
  const [isEnabled, setIsEnabled] = useState(true);

  // Live sample input luminance [0-255]
  const [sampleLuminance, setSampleLuminance] = useState(30);

  const currentResult = useMemo(
    () =>
      localCalculateADRTone(
        sampleLuminance,
        shadowLift,
        gamma,
        shoulderClamp,
        whitePoint,
        isEnabled
      ),
    [
      sampleLuminance,
      shadowLift,
      gamma,
      shoulderClamp,
      whitePoint,
      isEnabled,
    ]
  );

  // Keyboard hotkey 'R' / 'r' toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        (activeEl as HTMLElement)?.isContentEditable;

      if (!isInput && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault();
        setIsHUDOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const selectPreset = useCallback((presetKey: ADRPresetName) => {
    setPresetName(presetKey);
    const p = ADR_TONE_PRESETS[presetKey];
    if (p) {
      setShadowLift(p.shadowLift);
      setGamma(p.gamma);
      setShoulderClamp(p.shoulderClamp);
      setWhitePoint(p.whitePoint);
    }
  }, []);

  return {
    isHUDOpen,
    setIsHUDOpen,
    presetName,
    setPresetName,
    shadowLift,
    setShadowLift,
    gamma,
    setGamma,
    shoulderClamp,
    setShoulderClamp,
    whitePoint,
    setWhitePoint,
    isEnabled,
    setIsEnabled,
    sampleLuminance,
    setSampleLuminance,
    currentResult,
    selectPreset,
  };
}
