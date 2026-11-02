/**
 * KuraScroll - Sprint 104: Adaptive Per-Panel Reading Gaze Anchor & Eye-Rest Aperture Shutter Hook
 * 
 * Hardware-tuned for Intel Pentium T4500 (2C/2T @ 2.3GHz, Penryn 45nm, no AVX) & Intel GMA 4500MHD.
 * Maintains non-occluding peripheral aperture vignetting and circadian warmth to prevent ocular asthenopia.
 * Bound to key 'R' for HUD toggling.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

export type ShutterMode = 'subtle_vignette' | 'focus_spotlight' | 'circadian_warmth' | 'disabled';

export interface AnchorPoint {
  x: number;
  y: number;
}

export interface Viewport {
  width: number;
  height: number;
}

export interface EyeRestProfile {
  seriesId: string;
  shutterMode: ShutterMode;
  apertureRadiusPx: number;
  falloffPct: number;
  restIntervalMin: number;
  eyeCareWarmthK: number;
  isEnabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface EyeRestApertureResult {
  shutterMode: ShutterMode;
  isRestActive: boolean;
  innerRadiusPx: number;
  outerRadiusPx: number;
  radialGradientCss: string;
  warmthFilterCss: string;
  vignetteOpacity: number;
  warmthSepiaPct: number;
  latencyUs: number;
}

export const EYE_REST_PRESETS: Record<ShutterMode, {
  name: ShutterMode;
  shutterMode: ShutterMode;
  label: string;
  apertureRadiusPx: number;
  falloffPct: number;
  restIntervalMin: number;
  eyeCareWarmthK: number;
  description: string;
}> = {
  subtle_vignette: {
    name: 'subtle_vignette',
    shutterMode: 'subtle_vignette',
    label: 'Subtle Vignette (Standard Comfort)',
    apertureRadiusPx: 320,
    falloffPct: 35,
    restIntervalMin: 20,
    eyeCareWarmthK: 3200,
    description: 'Gentle peripheral darkening focused on active manga panel to reduce peripheral ocular strain',
  },
  focus_spotlight: {
    name: 'focus_spotlight',
    shutterMode: 'focus_spotlight',
    label: 'Focus Spotlight (High Concentration)',
    apertureRadiusPx: 240,
    falloffPct: 25,
    restIntervalMin: 15,
    eyeCareWarmthK: 3000,
    description: 'Tighter aperture mask directing gaze to active dialogue bubble with deeper background dimming',
  },
  circadian_warmth: {
    name: 'circadian_warmth',
    shutterMode: 'circadian_warmth',
    label: 'Circadian Warmth (Late Night Reading)',
    apertureRadiusPx: 400,
    falloffPct: 50,
    restIntervalMin: 25,
    eyeCareWarmthK: 2400,
    description: 'Candlelight warmth spectrum filter with broad aperture to relax ciliary eye muscles before sleep',
  },
  disabled: {
    name: 'disabled',
    shutterMode: 'disabled',
    label: 'Disabled (Pure Viewport)',
    apertureRadiusPx: 320,
    falloffPct: 35,
    restIntervalMin: 20,
    eyeCareWarmthK: 6500,
    description: 'No aperture shutter or warmth filtering applied',
  },
};

export function localCalculateEyeRestAperture(
  anchor: AnchorPoint = { x: 640, y: 360 },
  viewport: Viewport = { width: 1280, height: 720 },
  apertureRadiusPx: number = 320,
  falloffPct: number = 35,
  elapsedReadingMin: number = 0,
  restIntervalMin: number = 20,
  eyeCareWarmthK: number = 3200,
  mode: ShutterMode = 'subtle_vignette',
  isEnabled: boolean = true
): EyeRestApertureResult {
  const start = performance.now();

  const radius = Math.max(100, Math.min(800, apertureRadiusPx));
  const falloff = Math.max(10, Math.min(80, falloffPct));
  const restInterval = Math.max(5, Math.min(60, restIntervalMin));
  const warmth = Math.max(2200, Math.min(6500, eyeCareWarmthK));

  const ax = Math.max(0, Math.min(viewport.width, anchor.x));
  const ay = Math.max(0, Math.min(viewport.height, anchor.y));

  if (!isEnabled || mode === 'disabled') {
    return {
      shutterMode: mode,
      isRestActive: false,
      innerRadiusPx: radius,
      outerRadiusPx: radius,
      radialGradientCss: 'none',
      warmthFilterCss: 'none',
      vignetteOpacity: 0.0,
      warmthSepiaPct: 0,
      latencyUs: (performance.now() - start) * 1000,
    };
  }

  const isRestActive = elapsedReadingMin >= restInterval;
  const innerRadiusPx = Math.round(radius * (1.0 - falloff / 100));
  const outerRadiusPx = radius;

  let baseOpacity = 0.30;
  if (mode === 'focus_spotlight') baseOpacity = 0.45;
  if (mode === 'circadian_warmth') baseOpacity = 0.25;
  const vignetteOpacity = isRestActive ? Math.min(0.65, baseOpacity + 0.15) : baseOpacity;

  const baseSepia = Math.max(0, Math.min(30, Math.round((6500 - warmth) / 140)));
  const warmthSepiaPct = isRestActive ? Math.min(35, baseSepia + 5) : baseSepia;

  const radialGradientCss = `radial-gradient(circle at ${ax}px ${ay}px, rgba(0,0,0,0) ${innerRadiusPx}px, rgba(12,12,14,${vignetteOpacity.toFixed(2)}) ${outerRadiusPx}px)`;
  const warmthFilterCss = warmthSepiaPct > 0 ? `sepia(${warmthSepiaPct}%)` : 'none';

  return {
    shutterMode: mode,
    isRestActive,
    innerRadiusPx,
    outerRadiusPx,
    radialGradientCss,
    warmthFilterCss,
    vignetteOpacity,
    warmthSepiaPct,
    latencyUs: (performance.now() - start) * 1000,
  };
}

export interface UseEyeRestProps {
  seriesId?: string;
  initialMode?: ShutterMode;
  anchor?: AnchorPoint;
  viewport?: Viewport;
  elapsedReadingMin?: number;
}

export interface UseEyeRestReturn {
  isHUDVisible: boolean;
  setIsHUDVisible: (visible: boolean | ((prev: boolean) => boolean)) => void;
  toggleHUD: () => void;
  profile: EyeRestProfile;
  setProfile: React.Dispatch<React.SetStateAction<EyeRestProfile>>;
  result: EyeRestApertureResult;
  applyPreset: (mode: ShutterMode) => void;
}

export function useEyeRest(props: UseEyeRestProps = {}): UseEyeRestReturn {
  const {
    seriesId = 'default-series',
    initialMode = 'subtle_vignette',
    anchor = { x: 640, y: 360 },
    viewport = { width: 1280, height: 720 },
    elapsedReadingMin = 0,
  } = props;

  const [isHUDVisible, setIsHUDVisible] = useState(false);

  const initialProfile = useMemo<EyeRestProfile>(() => {
    const preset = EYE_REST_PRESETS[initialMode] || EYE_REST_PRESETS.subtle_vignette;
    return {
      seriesId,
      shutterMode: preset.shutterMode,
      apertureRadiusPx: preset.apertureRadiusPx,
      falloffPct: preset.falloffPct,
      restIntervalMin: preset.restIntervalMin,
      eyeCareWarmthK: preset.eyeCareWarmthK,
      isEnabled: true,
      createdAt: 0,
      updatedAt: 0,
    };
  }, [seriesId, initialMode]);

  const [profile, setProfile] = useState<EyeRestProfile>(initialProfile);

  const toggleHUD = useCallback(() => {
    setIsHUDVisible(prev => !prev);
  }, []);

  // Keyboard shortcut listener: 'R' / 'r'
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
        return;
      }
      if (event.key === 'r' || event.key === 'R') {
        event.preventDefault();
        toggleHUD();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleHUD]);

  // Compute eye rest aperture result
  const result = useMemo(() => {
    return localCalculateEyeRestAperture(
      anchor,
      viewport,
      profile.apertureRadiusPx,
      profile.falloffPct,
      elapsedReadingMin,
      profile.restIntervalMin,
      profile.eyeCareWarmthK,
      profile.shutterMode,
      profile.isEnabled
    );
  }, [
    anchor,
    viewport,
    profile.apertureRadiusPx,
    profile.falloffPct,
    elapsedReadingMin,
    profile.restIntervalMin,
    profile.eyeCareWarmthK,
    profile.shutterMode,
    profile.isEnabled,
  ]);

  const applyPreset = useCallback((mode: ShutterMode) => {
    const preset = EYE_REST_PRESETS[mode];
    if (!preset) return;
    setProfile(prev => ({
      ...prev,
      shutterMode: preset.shutterMode,
      apertureRadiusPx: preset.apertureRadiusPx,
      falloffPct: preset.falloffPct,
      restIntervalMin: preset.restIntervalMin,
      eyeCareWarmthK: preset.eyeCareWarmthK,
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
