/**
 * KuraScroll - Sprint 121: Dynamic Atmospheric Vignette Shader & Depth-of-Field Aperture Simulator Hook
 * 
 * Hardware Target: Intel Pentium T4500 (2C/2T @ 2.30 GHz, Penryn 45nm, no AVX, heap <= 512MB) & Intel GMA 4500MHD.
 * Pure zero-allocation analytical vignette falloff, smoothstep aperture, and DoF contrast simulation.
 * Bound to key 'V' / 'v' for HUD toggling.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

export type VignettePresetName =
  | 'cinematic_macro'
  | 'action_tunnel'
  | 'subtle_vignette'
  | 'dream_flashback'
  | 'raw_disabled';

export interface VignetteApertureProfile {
  seriesId: string;
  presetName: VignettePresetName;
  innerRadius: number;
  outerRadius: number;
  vignetteStrength: number;
  dofBlurFactor: number;
  focusXPct: number;
  focusYPct: number;
  aspectRatio: number;
  isEnabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface VignetteAperturePreset {
  name: VignettePresetName;
  label: string;
  innerRadius: number;
  outerRadius: number;
  vignetteStrength: number;
  dofBlurFactor: number;
  focusXPct: number;
  focusYPct: number;
  aspectRatio: number;
  description: string;
}

export const VIGNETTE_APERTURE_PRESETS: Record<VignettePresetName, VignetteAperturePreset> = {
  cinematic_macro: {
    name: 'cinematic_macro',
    label: 'Cinematic Macro Focus',
    innerRadius: 0.25,
    outerRadius: 0.85,
    vignetteStrength: 0.70,
    dofBlurFactor: 0.60,
    focusXPct: 50.0,
    focusYPct: 50.0,
    aspectRatio: 1.0,
    description: 'Dramatic close-up framing highlighting dialogue balloon or character expressions.',
  },
  action_tunnel: {
    name: 'action_tunnel',
    label: 'Action Shonen Tunnel',
    innerRadius: 0.15,
    outerRadius: 0.60,
    vignetteStrength: 0.85,
    dofBlurFactor: 0.75,
    focusXPct: 50.0,
    focusYPct: 45.0,
    aspectRatio: 0.85,
    description: 'Intense speed tunnel effect focusing user attention on rapid motion sequences.',
  },
  subtle_vignette: {
    name: 'subtle_vignette',
    label: 'Subtle Reading Comfort',
    innerRadius: 0.45,
    outerRadius: 1.10,
    vignetteStrength: 0.40,
    dofBlurFactor: 0.35,
    focusXPct: 50.0,
    focusYPct: 50.0,
    aspectRatio: 1.0,
    description: 'Gentle peripheral darkening reducing screen glare and peripheral fatigue.',
  },
  dream_flashback: {
    name: 'dream_flashback',
    label: 'Dream & Flashback Mist',
    innerRadius: 0.20,
    outerRadius: 0.75,
    vignetteStrength: 0.65,
    dofBlurFactor: 0.80,
    focusXPct: 50.0,
    focusYPct: 40.0,
    aspectRatio: 1.2,
    description: 'Soft atmospheric falloff evoking ethereal memory or nostalgic flashback scenes.',
  },
  raw_disabled: {
    name: 'raw_disabled',
    label: 'Raw Pass-Through (Disabled)',
    innerRadius: 1.0,
    outerRadius: 1.0,
    vignetteStrength: 0.0,
    dofBlurFactor: 0.0,
    focusXPct: 50.0,
    focusYPct: 50.0,
    aspectRatio: 1.0,
    description: 'Pure unaltered edge display without vignette darkening or aperture falloff.',
  },
};

export interface VignetteApertureResult {
  normalizedDistance: number;
  vignetteAlpha: number;
  edgeContrast: number;
  cssGradient: string;
  latencyUs: number;
}

export function localCalculateVignetteAperture(
  pixelX: number,
  pixelY: number,
  viewportWidth: number,
  viewportHeight: number,
  focusXPct: number = 50.0,
  focusYPct: number = 50.0,
  innerRadius: number = 0.45,
  outerRadius: number = 1.10,
  vignetteStrength: number = 0.40,
  dofBlurFactor: number = 0.35,
  aspectRatio: number = 1.0,
  isEnabled: boolean = true
): VignetteApertureResult {
  const startHr = typeof performance !== 'undefined' ? performance.now() : 0;

  if (!isEnabled) {
    return {
      normalizedDistance: 0.0,
      vignetteAlpha: 0.0,
      edgeContrast: 1.0,
      cssGradient: 'none',
      latencyUs: typeof performance !== 'undefined' ? (performance.now() - startHr) * 1000 : 0.2,
    };
  }

  const w = Math.max(1.0, viewportWidth);
  const h = Math.max(1.0, viewportHeight);

  const fx = (focusXPct / 100.0) * w;
  const fy = (focusYPct / 100.0) * h;

  const halfDiag = 0.5 * Math.sqrt(w * w + h * h);
  const rx = Math.max(1.0, halfDiag * Math.sqrt(aspectRatio));
  const ry = Math.max(1.0, halfDiag / Math.sqrt(aspectRatio));

  const dx = (pixelX - fx) / rx;
  const dy = (pixelY - fy) / ry;
  const dNorm = Math.sqrt(dx * dx + dy * dy);

  const inR = Math.max(0.0, Math.min(1.0, innerRadius));
  const outR = Math.max(inR + 0.01, Math.min(2.5, outerRadius));

  let t = 0.0;
  if (dNorm > inR) {
    t = Math.min(1.0, (dNorm - inR) / (outR - inR));
  }
  const smooth = t * t * (3.0 - 2.0 * t);

  const clampedStrength = Math.max(0.0, Math.min(1.0, vignetteStrength));
  const vignetteAlpha = smooth * clampedStrength;
  const clampedDof = Math.max(0.0, Math.min(1.0, dofBlurFactor));
  const edgeContrast = Math.max(0.1, 1.0 - smooth * clampedDof * 0.65);

  const inPct = Math.round(inR * 100);
  const outPct = Math.round(outR * 100);
  const maxAlpha = vignetteAlpha.toFixed(3);
  const cssGradient = `radial-gradient(ellipse ${Math.round(rx)}px ${Math.round(ry)}px at ${focusXPct.toFixed(1)}% ${focusYPct.toFixed(1)}%, rgba(0,0,0,0) ${inPct}%, rgba(0,0,0,${maxAlpha}) ${outPct}%)`;

  const endHr = typeof performance !== 'undefined' ? performance.now() : 0;

  return {
    normalizedDistance: dNorm,
    vignetteAlpha,
    edgeContrast,
    cssGradient,
    latencyUs: typeof performance !== 'undefined' ? (endHr - startHr) * 1000 : 0.2,
  };
}

export function useVignetteAperture(seriesId: string) {
  const [isHUDOpen, setIsHUDOpen] = useState(false);
  const [presetName, setPresetName] = useState<VignettePresetName>('subtle_vignette');
  const [innerRadius, setInnerRadius] = useState(0.45);
  const [outerRadius, setOuterRadius] = useState(1.10);
  const [vignetteStrength, setVignetteStrength] = useState(0.40);
  const [dofBlurFactor, setDofBlurFactor] = useState(0.35);
  const [focusXPct, setFocusXPct] = useState(50.0);
  const [focusYPct, setFocusYPct] = useState(50.0);
  const [aspectRatio, setAspectRatio] = useState(1.0);
  const [isEnabled, setIsEnabled] = useState(true);

  // Viewport dimensions sample (default: 800x600 reader canvas)
  const [viewport, setViewport] = useState({ w: 800, h: 600 });
  const [samplePixel, setSamplePixel] = useState({ x: 750, y: 550 });

  const currentResult = useMemo(
    () =>
      localCalculateVignetteAperture(
        samplePixel.x,
        samplePixel.y,
        viewport.w,
        viewport.h,
        focusXPct,
        focusYPct,
        innerRadius,
        outerRadius,
        vignetteStrength,
        dofBlurFactor,
        aspectRatio,
        isEnabled
      ),
    [
      samplePixel,
      viewport,
      focusXPct,
      focusYPct,
      innerRadius,
      outerRadius,
      vignetteStrength,
      dofBlurFactor,
      aspectRatio,
      isEnabled,
    ]
  );

  // Keyboard hotkey 'V' / 'v' toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        (activeEl as HTMLElement)?.isContentEditable;

      if (!isInput && (e.key === 'v' || e.key === 'V')) {
        e.preventDefault();
        setIsHUDOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const selectPreset = useCallback((presetKey: VignettePresetName) => {
    setPresetName(presetKey);
    const p = VIGNETTE_APERTURE_PRESETS[presetKey];
    if (p) {
      setInnerRadius(p.innerRadius);
      setOuterRadius(p.outerRadius);
      setVignetteStrength(p.vignetteStrength);
      setDofBlurFactor(p.dofBlurFactor);
      setFocusXPct(p.focusXPct);
      setFocusYPct(p.focusYPct);
      setAspectRatio(p.aspectRatio);
    }
  }, []);

  return {
    isHUDOpen,
    setIsHUDOpen,
    presetName,
    setPresetName,
    innerRadius,
    setInnerRadius,
    outerRadius,
    setOuterRadius,
    vignetteStrength,
    setVignetteStrength,
    dofBlurFactor,
    setDofBlurFactor,
    focusXPct,
    setFocusXPct,
    focusYPct,
    setFocusYPct,
    aspectRatio,
    setAspectRatio,
    isEnabled,
    setIsEnabled,
    viewport,
    setViewport,
    samplePixel,
    setSamplePixel,
    currentResult,
    selectPreset,
  };
}
