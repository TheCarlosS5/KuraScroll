/**
 * KuraScroll - Sprint 118: Adaptive Perceptual Dark-Adaptation Retinal Preserver & Contrast Compensator Hook
 * 
 * Hardware Target: Intel Pentium T4500 (2C/2T @ 2.30 GHz, Penryn 45nm, no AVX, heap <= 512MB) & Intel GMA 4500MHD.
 * Pure asymmetric EMA temporal adaptation with white-point clamping, 0 CSS blur, 0 CLS.
 * Bound to key 'D' / 'd' for HUD toggling.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

export type DarkAdaptationPresetName =
  | 'night_shonen'
  | 'midnight_reader'
  | 'daylight_crisp'
  | 'paper_sepia';

export interface DarkAdaptationProfile {
  seriesId: string;
  presetName: DarkAdaptationPresetName;
  tauDarkMs: number;
  tauBrightMs: number;
  comfortLuminance: number;
  glareThreshold: number;
  baseWhitePoint: number;
  glareAttenuation: number;
  contrastBase: number;
  contrastCompensation: number;
  isEnabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface DarkAdaptationPreset {
  name: DarkAdaptationPresetName;
  label: string;
  tauDarkMs: number;
  tauBrightMs: number;
  comfortLuminance: number;
  glareThreshold: number;
  baseWhitePoint: number;
  glareAttenuation: number;
  contrastBase: number;
  contrastCompensation: number;
  description: string;
}

export const DARK_ADAPTATION_PRESETS: Record<DarkAdaptationPresetName, DarkAdaptationPreset> = {
  midnight_reader: {
    name: 'midnight_reader',
    label: 'Midnight Reader (Dark Room)',
    tauDarkMs: 1800,
    tauBrightMs: 450,
    comfortLuminance: 0.22,
    glareThreshold: 0.70,
    baseWhitePoint: 0.88,
    glareAttenuation: 0.35,
    contrastBase: 1.08,
    contrastCompensation: 0.22,
    description: 'Subtle white-point dimming and slow pupil-dilation curve tailored for pitch-black bedrooms.',
  },
  night_shonen: {
    name: 'night_shonen',
    label: 'Night Shonen (Action Contrast)',
    tauDarkMs: 1500,
    tauBrightMs: 400,
    comfortLuminance: 0.28,
    glareThreshold: 0.75,
    baseWhitePoint: 0.92,
    glareAttenuation: 0.30,
    contrastBase: 1.15,
    contrastCompensation: 0.25,
    description: 'Crisp black inks and boosted ink contrast preventing dark panel muddying on 6-bit TN screens.',
  },
  daylight_crisp: {
    name: 'daylight_crisp',
    label: 'Daylight Crisp (Standard)',
    tauDarkMs: 800,
    tauBrightMs: 300,
    comfortLuminance: 0.50,
    glareThreshold: 0.85,
    baseWhitePoint: 1.00,
    glareAttenuation: 0.10,
    contrastBase: 1.00,
    contrastCompensation: 0.05,
    description: 'Neutral 1:1 color pass-through with minimal glare damping for bright ambient daylight.',
  },
  paper_sepia: {
    name: 'paper_sepia',
    label: 'Paper Sepia (Warm Retinal)',
    tauDarkMs: 2000,
    tauBrightMs: 500,
    comfortLuminance: 0.30,
    glareThreshold: 0.65,
    baseWhitePoint: 0.85,
    glareAttenuation: 0.40,
    contrastBase: 1.05,
    contrastCompensation: 0.18,
    description: 'Soft amber tone clamping and high glare suppression mimicking vintage book stock.',
  },
};

export interface DarkAdaptationResult {
  adaptedLuminance: number;
  whitePoint: number;
  contrast: number;
  effectiveBrightness: number;
  glareRatio: number;
  latencyUs: number;
}

export function localCalculateDarkAdaptation(
  inputLuminance: number,
  prevAdaptedLuminance: number,
  dtMs: number = 16.67,
  tauDarkMs: number = 1800,
  tauBrightMs: number = 450,
  comfortLuminance: number = 0.22,
  glareThreshold: number = 0.70,
  baseWhitePoint: number = 0.92,
  glareAttenuation: number = 0.35,
  contrastBase: number = 1.05,
  contrastCompensation: number = 0.20,
  isEnabled: boolean = true
): DarkAdaptationResult {
  const startHr = typeof performance !== 'undefined' ? performance.now() : 0;

  if (!isEnabled) {
    return {
      adaptedLuminance: inputLuminance,
      whitePoint: 1.0,
      contrast: 1.0,
      effectiveBrightness: 1.0,
      glareRatio: 0.0,
      latencyUs: typeof performance !== 'undefined' ? (performance.now() - startHr) * 1000 : 0.2,
    };
  }

  const isDarkening = inputLuminance < prevAdaptedLuminance;
  const tau = isDarkening ? tauDarkMs : tauBrightMs;
  const alpha = 1.0 - Math.exp(-Math.max(1, dtMs) / Math.max(10, tau));

  const adaptedLum = prevAdaptedLuminance + alpha * (inputLuminance - prevAdaptedLuminance);

  let glareRatio = 0.0;
  if (adaptedLum > glareThreshold && glareThreshold < 1.0) {
    glareRatio = (adaptedLum - glareThreshold) / (1.0 - glareThreshold);
    if (glareRatio > 1.0) glareRatio = 1.0;
  }

  const whitePoint = Math.max(
    0.50,
    Math.min(1.0, baseWhitePoint * (1.0 - glareRatio * glareAttenuation))
  );

  const lumDiff = comfortLuminance - adaptedLum;
  const contrast = Math.max(
    0.80,
    Math.min(1.50, contrastBase + lumDiff * contrastCompensation)
  );

  const endHr = typeof performance !== 'undefined' ? performance.now() : 0;

  return {
    adaptedLuminance: adaptedLum,
    whitePoint,
    contrast,
    effectiveBrightness: whitePoint,
    glareRatio,
    latencyUs: typeof performance !== 'undefined' ? (endHr - startHr) * 1000 : 0.2,
  };
}

export function useDarkAdaptation(seriesId: string) {
  const [isHUDOpen, setIsHUDOpen] = useState(false);
  const [presetName, setPresetName] = useState<DarkAdaptationPresetName>('midnight_reader');
  const [tauDarkMs, setTauDarkMs] = useState(1800);
  const [tauBrightMs, setTauBrightMs] = useState(450);
  const [comfortLuminance, setComfortLuminance] = useState(0.22);
  const [glareThreshold, setGlareThreshold] = useState(0.70);
  const [baseWhitePoint, setBaseWhitePoint] = useState(0.88);
  const [glareAttenuation, setGlareAttenuation] = useState(0.35);
  const [contrastBase, setContrastBase] = useState(1.08);
  const [contrastCompensation, setContrastCompensation] = useState(0.22);
  const [isEnabled, setIsEnabled] = useState(true);

  // Live simulation coordinates
  const [inputLuminance, setInputLuminance] = useState(0.85);
  const [prevAdaptedLuminance, setPrevAdaptedLuminance] = useState(0.20);

  const currentResult = useMemo(
    () =>
      localCalculateDarkAdaptation(
        inputLuminance,
        prevAdaptedLuminance,
        16.67,
        tauDarkMs,
        tauBrightMs,
        comfortLuminance,
        glareThreshold,
        baseWhitePoint,
        glareAttenuation,
        contrastBase,
        contrastCompensation,
        isEnabled
      ),
    [
      inputLuminance,
      prevAdaptedLuminance,
      tauDarkMs,
      tauBrightMs,
      comfortLuminance,
      glareThreshold,
      baseWhitePoint,
      glareAttenuation,
      contrastBase,
      contrastCompensation,
      isEnabled,
    ]
  );

  // Keyboard hotkey 'D' / 'd' toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        (activeEl as HTMLElement)?.isContentEditable;

      if (!isInput && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        setIsHUDOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const selectPreset = useCallback((presetKey: DarkAdaptationPresetName) => {
    setPresetName(presetKey);
    const p = DARK_ADAPTATION_PRESETS[presetKey];
    if (p) {
      setTauDarkMs(p.tauDarkMs);
      setTauBrightMs(p.tauBrightMs);
      setComfortLuminance(p.comfortLuminance);
      setGlareThreshold(p.glareThreshold);
      setBaseWhitePoint(p.baseWhitePoint);
      setGlareAttenuation(p.glareAttenuation);
      setContrastBase(p.contrastBase);
      setContrastCompensation(p.contrastCompensation);
    }
  }, []);

  const simulateLuminanceStep = useCallback((newInputLum: number) => {
    setPrevAdaptedLuminance((prev) => {
      // Step adaptation forward
      const res = localCalculateDarkAdaptation(
        newInputLum,
        prev,
        100.0, // 100ms delta
        tauDarkMs,
        tauBrightMs,
        comfortLuminance,
        glareThreshold,
        baseWhitePoint,
        glareAttenuation,
        contrastBase,
        contrastCompensation,
        isEnabled
      );
      return res.adaptedLuminance;
    });
    setInputLuminance(newInputLum);
  }, [
    tauDarkMs,
    tauBrightMs,
    comfortLuminance,
    glareThreshold,
    baseWhitePoint,
    glareAttenuation,
    contrastBase,
    contrastCompensation,
    isEnabled,
  ]);

  return {
    isHUDOpen,
    setIsHUDOpen,
    presetName,
    setPresetName,
    tauDarkMs,
    setTauDarkMs,
    tauBrightMs,
    setTauBrightMs,
    comfortLuminance,
    setComfortLuminance,
    glareThreshold,
    setGlareThreshold,
    baseWhitePoint,
    setBaseWhitePoint,
    glareAttenuation,
    setGlareAttenuation,
    contrastBase,
    setContrastBase,
    contrastCompensation,
    setContrastCompensation,
    isEnabled,
    setIsEnabled,
    inputLuminance,
    setInputLuminance,
    prevAdaptedLuminance,
    setPrevAdaptedLuminance,
    currentResult,
    selectPreset,
    simulateLuminanceStep,
  };
}
