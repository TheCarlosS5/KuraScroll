/**
 * KuraScroll - Sprint 131: Subpixel Mechanical Rotary Press Plate Misregistration & Ink Trapping Hook
 * 
 * Hardware Target: Intel Pentium T4500 (2C/2T @ 2.30 GHz, Penryn 45nm, no AVX, heap <= 512MB) & Intel GMA 4500MHD.
 * Zero-allocation closed-form CMYK plate shift, directional edge gradient projection, and ink trapping dilation.
 * Bound to key 'Shift + T' for HUD toggling.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

export type InkTrappingPresetName =
  | 'vintage_rotary_offset_80s'
  | 'shonen_color_centerfold'
  | 'modern_cmyk_tight'
  | 'misregistered_retro_fringe'
  | 'raw_fixed';

export type InkTrappingMode = 'spread' | 'choke' | 'auto';

export interface InkTrappingProfile {
  seriesId: string;
  presetName: InkTrappingPresetName;
  shiftCx: number;
  shiftCy: number;
  shiftMx: number;
  shiftMy: number;
  shiftYx: number;
  shiftYy: number;
  shiftKx: number;
  shiftKy: number;
  trapWidth: number;
  trapMode: InkTrappingMode;
  edgeThreshold: number;
  isEnabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface InkTrappingPreset {
  name: InkTrappingPresetName;
  label: string;
  shiftCx: number;
  shiftCy: number;
  shiftMx: number;
  shiftMy: number;
  shiftYx: number;
  shiftYy: number;
  shiftKx: number;
  shiftKy: number;
  trapWidth: number;
  trapMode: InkTrappingMode;
  edgeThreshold: number;
  description: string;
}

export const INK_TRAPPING_PRESETS: Record<InkTrappingPresetName, InkTrappingPreset> = {
  vintage_rotary_offset_80s: {
    name: 'vintage_rotary_offset_80s',
    label: 'Vintage Rotary Offset 1980s',
    shiftCx: 0.60,
    shiftCy: -0.40,
    shiftMx: -0.30,
    shiftMy: 0.50,
    shiftYx: 0.20,
    shiftYy: 0.40,
    shiftKx: 0.00,
    shiftKy: 0.00,
    trapWidth: 0.35,
    trapMode: 'auto',
    edgeThreshold: 0.15,
    description: 'Authentic 80s rotary press printing with mechanical cylinder play, slight magenta drift, and balanced ink trapping.',
  },
  shonen_color_centerfold: {
    name: 'shonen_color_centerfold',
    label: 'Shōnen Color Centerfold',
    shiftCx: 0.30,
    shiftCy: -0.20,
    shiftMx: -0.20,
    shiftMy: 0.30,
    shiftYx: 0.10,
    shiftYy: 0.10,
    shiftKx: 0.00,
    shiftKy: 0.00,
    trapWidth: 0.25,
    trapMode: 'spread',
    edgeThreshold: 0.12,
    description: 'High-speed magazine color splash spread with moderate registration tolerance and primary color spread under keyline black.',
  },
  modern_cmyk_tight: {
    name: 'modern_cmyk_tight',
    label: 'Modern Tight Registration',
    shiftCx: 0.05,
    shiftCy: 0.05,
    shiftMx: -0.05,
    shiftMy: 0.05,
    shiftYx: 0.00,
    shiftYy: 0.00,
    shiftKx: 0.00,
    shiftKy: 0.00,
    trapWidth: 0.10,
    trapMode: 'auto',
    edgeThreshold: 0.10,
    description: 'Modern digital CTP (computer-to-plate) precision alignment with microscopic protective ink trapping.',
  },
  misregistered_retro_fringe: {
    name: 'misregistered_retro_fringe',
    label: 'Retro Misregistered Fringe',
    shiftCx: 1.20,
    shiftCy: -0.80,
    shiftMx: -0.90,
    shiftMy: 1.00,
    shiftYx: 0.50,
    shiftYy: 0.60,
    shiftKx: 0.00,
    shiftKy: 0.00,
    trapWidth: 0.50,
    trapMode: 'choke',
    edgeThreshold: 0.20,
    description: 'Pronounced nostalgic cyan and magenta halo fringing from heavily worn rotary press plates with heavy ink choke.',
  },
  raw_fixed: {
    name: 'raw_fixed',
    label: 'Raw Pass-Through (Disabled)',
    shiftCx: 0.00,
    shiftCy: 0.00,
    shiftMx: 0.00,
    shiftMy: 0.00,
    shiftYx: 0.00,
    shiftYy: 0.00,
    shiftKx: 0.00,
    shiftKy: 0.00,
    trapWidth: 0.00,
    trapMode: 'auto',
    edgeThreshold: 0.15,
    description: 'Bypasses plate offset shifting and ink trapping, preserving pure unmodified digital scan pixels.',
  },
};

export interface InkTrappingResult {
  inR: number;
  inG: number;
  inB: number;
  outR: number;
  outG: number;
  outB: number;
  cEff: number;
  mEff: number;
  yEff: number;
  kEff: number;
  trapIntensity: number;
  latencyUs: number;
}

export function localCalculateInkTrapping(
  inR: number,
  inG: number,
  inB: number,
  gradX: number = 0.0,
  gradY: number = 0.0,
  shiftCx: number = 0.60,
  shiftCy: number = -0.40,
  shiftMx: number = -0.30,
  shiftMy: number = 0.50,
  shiftYx: number = 0.20,
  shiftYy: number = 0.40,
  shiftKx: number = 0.00,
  shiftKy: number = 0.00,
  trapWidth: number = 0.35,
  trapMode: InkTrappingMode = 'auto',
  edgeThreshold: number = 0.15,
  isEnabled: boolean = true
): InkTrappingResult {
  const startHr = typeof performance !== 'undefined' ? performance.now() : 0;

  if (!isEnabled) {
    return {
      inR,
      inG,
      inB,
      outR: inR,
      outG: inG,
      outB: inB,
      cEff: 0,
      mEff: 0,
      yEff: 0,
      kEff: 0,
      trapIntensity: 0,
      latencyUs: typeof performance !== 'undefined' ? (performance.now() - startHr) * 1000 : 0.2,
    };
  }

  const rn = inR / 255.0;
  const gn = inG / 255.0;
  const bn = inB / 255.0;

  const maxRgb = rn > gn ? (rn > bn ? rn : bn) : (gn > bn ? gn : bn);
  const k = 1.0 - maxRgb;

  let c = 0;
  let m = 0;
  let y = 0;

  if (k < 0.999) {
    const invK = 1.0 / (1.0 - k);
    c = (1.0 - rn - k) * invK;
    m = (1.0 - gn - k) * invK;
    y = (1.0 - bn - k) * invK;
    c = c < 0 ? 0 : c > 1 ? 1 : c;
    m = m < 0 ? 0 : m > 1 ? 1 : m;
    y = y < 0 ? 0 : y > 1 ? 1 : y;
  }

  const absGx = gradX < 0 ? -gradX : gradX;
  const absGy = gradY < 0 ? -gradY : gradY;
  const gradMag = absGx > absGy ? absGx : absGy;

  let cShifted = c;
  let mShifted = m;
  let yShifted = y;
  let kShifted = k;

  if (gradMag > edgeThreshold) {
    const dC = (shiftCx * gradX + shiftCy * gradY) * 0.15;
    const dM = (shiftMx * gradX + shiftMy * gradY) * 0.15;
    const dY = (shiftYx * gradX + shiftYy * gradY) * 0.15;
    const dK = (shiftKx * gradX + shiftKy * gradY) * 0.15;

    cShifted = c + dC;
    mShifted = m + dM;
    yShifted = y + dY;
    kShifted = k + dK;

    cShifted = cShifted < 0 ? 0 : cShifted > 1 ? 1 : cShifted;
    mShifted = mShifted < 0 ? 0 : mShifted > 1 ? 1 : mShifted;
    yShifted = yShifted < 0 ? 0 : yShifted > 1 ? 1 : yShifted;
    kShifted = kShifted < 0 ? 0 : kShifted > 1 ? 1 : kShifted;
  }

  let trapIntensity = 0;
  if (trapWidth > 0 && gradMag > edgeThreshold) {
    const colorSum = (cShifted + mShifted + yShifted) / 3.0;
    const rawTrap = trapWidth * kShifted * colorSum;
    trapIntensity = rawTrap < 0 ? 0 : rawTrap > 0.5 ? 0.5 : rawTrap;

    if (trapMode === 'spread') {
      cShifted = cShifted + trapIntensity * (1.0 - cShifted);
      mShifted = mShifted + trapIntensity * (1.0 - mShifted);
      yShifted = yShifted + trapIntensity * (1.0 - yShifted);
    } else if (trapMode === 'choke') {
      kShifted = kShifted + trapIntensity * (1.0 - kShifted);
    } else {
      const halfTrap = trapIntensity * 0.5;
      cShifted = cShifted + halfTrap * (1.0 - cShifted);
      mShifted = mShifted + halfTrap * (1.0 - mShifted);
      yShifted = yShifted + halfTrap * (1.0 - yShifted);
      kShifted = kShifted + halfTrap * (1.0 - kShifted);
    }

    cShifted = cShifted > 1 ? 1 : cShifted;
    mShifted = mShifted > 1 ? 1 : mShifted;
    yShifted = yShifted > 1 ? 1 : yShifted;
    kShifted = kShifted > 1 ? 1 : kShifted;
  }

  const rRec = (1.0 - cShifted) * (1.0 - kShifted);
  const gRec = (1.0 - mShifted) * (1.0 - kShifted);
  const bRec = (1.0 - yShifted) * (1.0 - kShifted);

  const outR = Math.round(Math.max(0, Math.min(1, rRec)) * 255.0);
  const outG = Math.round(Math.max(0, Math.min(1, gRec)) * 255.0);
  const outB = Math.round(Math.max(0, Math.min(1, bRec)) * 255.0);

  const endHr = typeof performance !== 'undefined' ? performance.now() : 0;

  return {
    inR,
    inG,
    inB,
    outR,
    outG,
    outB,
    cEff: Math.round(cShifted * 1000) / 1000,
    mEff: Math.round(mShifted * 1000) / 1000,
    yEff: Math.round(yShifted * 1000) / 1000,
    kEff: Math.round(kShifted * 1000) / 1000,
    trapIntensity: Math.round(trapIntensity * 1000) / 1000,
    latencyUs: typeof performance !== 'undefined' ? (endHr - startHr) * 1000 : 0.4,
  };
}

export function useInkTrapping(seriesId: string) {
  const [isHUDOpen, setIsHUDOpen] = useState(false);
  const [presetName, setPresetName] = useState<InkTrappingPresetName>('vintage_rotary_offset_80s');
  const [shiftCx, setShiftCx] = useState(0.60);
  const [shiftCy, setShiftCy] = useState(-0.40);
  const [shiftMx, setShiftMx] = useState(-0.30);
  const [shiftMy, setShiftMy] = useState(0.50);
  const [shiftYx, setShiftYx] = useState(0.20);
  const [shiftYy, setShiftYy] = useState(0.40);
  const [shiftKx, setShiftKx] = useState(0.00);
  const [shiftKy, setShiftKy] = useState(0.00);
  const [trapWidth, setTrapWidth] = useState(0.35);
  const [trapMode, setTrapMode] = useState<InkTrappingMode>('auto');
  const [edgeThreshold, setEdgeThreshold] = useState(0.15);
  const [isEnabled, setIsEnabled] = useState(true);

  // Live probe inputs
  const [probeR, setProbeR] = useState(210);
  const [probeG, setProbeG] = useState(80);
  const [probeB, setProbeB] = useState(40);
  const [probeGradX, setProbeGradX] = useState(0.6);
  const [probeGradY, setProbeGradY] = useState(0.3);

  const currentResult = useMemo(
    () =>
      localCalculateInkTrapping(
        probeR,
        probeG,
        probeB,
        probeGradX,
        probeGradY,
        shiftCx,
        shiftCy,
        shiftMx,
        shiftMy,
        shiftYx,
        shiftYy,
        shiftKx,
        shiftKy,
        trapWidth,
        trapMode,
        edgeThreshold,
        isEnabled
      ),
    [
      probeR,
      probeG,
      probeB,
      probeGradX,
      probeGradY,
      shiftCx,
      shiftCy,
      shiftMx,
      shiftMy,
      shiftYx,
      shiftYy,
      shiftKx,
      shiftKy,
      trapWidth,
      trapMode,
      edgeThreshold,
      isEnabled,
    ]
  );

  const applyPreset = useCallback((presetKey: InkTrappingPresetName) => {
    const p = INK_TRAPPING_PRESETS[presetKey];
    if (!p) return;
    setPresetName(p.name);
    setShiftCx(p.shiftCx);
    setShiftCy(p.shiftCy);
    setShiftMx(p.shiftMx);
    setShiftMy(p.shiftMy);
    setShiftYx(p.shiftYx);
    setShiftYy(p.shiftYy);
    setShiftKx(p.shiftKx);
    setShiftKy(p.shiftKy);
    setTrapWidth(p.trapWidth);
    setTrapMode(p.trapMode);
    setEdgeThreshold(p.edgeThreshold);
    setIsEnabled(p.name !== 'raw_fixed');
  }, []);

  const toggleHUD = useCallback(() => {
    setIsHUDOpen((prev) => !prev);
  }, []);

  const closeHUD = useCallback(() => {
    setIsHUDOpen(false);
  }, []);

  // Keyboard shortcut: 'Shift + T' toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
        return;
      }
      if ((e.key === 'T' || e.key === 't') && e.shiftKey) {
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          setIsHUDOpen((prev) => !prev);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch initial profile
  useEffect(() => {
    if (!seriesId) return;

    let isMounted = true;
    const fetchProfile = async () => {
      try {
        const res = await fetch(`/api/v1/reader/ink-trapping/profile/${seriesId}`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.profile) {
            const p = data.profile;
            setPresetName(p.presetName);
            setShiftCx(p.shiftCx);
            setShiftCy(p.shiftCy);
            setShiftMx(p.shiftMx);
            setShiftMy(p.shiftMy);
            setShiftYx(p.shiftYx);
            setShiftYy(p.shiftYy);
            setShiftKx(p.shiftKx);
            setShiftKy(p.shiftKy);
            setTrapWidth(p.trapWidth);
            setTrapMode(p.trapMode);
            setEdgeThreshold(p.edgeThreshold);
            setIsEnabled(Boolean(p.isEnabled));
          }
        }
      } catch {
        // Fallback silently to defaults
      }
    };

    fetchProfile();
    return () => {
      isMounted = false;
    };
  }, [seriesId]);

  const saveProfile = useCallback(async () => {
    if (!seriesId) return;
    try {
      await fetch(`/api/v1/reader/ink-trapping/profile/${seriesId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          presetName,
          shiftCx,
          shiftCy,
          shiftMx,
          shiftMy,
          shiftYx,
          shiftYy,
          shiftKx,
          shiftKy,
          trapWidth,
          trapMode,
          edgeThreshold,
          isEnabled,
        }),
      });
    } catch {
      // Ignored in offline/mock environment
    }
  }, [
    seriesId,
    presetName,
    shiftCx,
    shiftCy,
    shiftMx,
    shiftMy,
    shiftYx,
    shiftYy,
    shiftKx,
    shiftKy,
    trapWidth,
    trapMode,
    edgeThreshold,
    isEnabled,
  ]);

  return {
    isHUDOpen,
    presetName,
    shiftCx,
    shiftCy,
    shiftMx,
    shiftMy,
    shiftYx,
    shiftYy,
    shiftKx,
    shiftKy,
    trapWidth,
    trapMode,
    edgeThreshold,
    isEnabled,
    probeR,
    probeG,
    probeB,
    probeGradX,
    probeGradY,
    currentResult,
    setIsHUDOpen,
    setPresetName,
    setShiftCx,
    setShiftCy,
    setShiftMx,
    setShiftMy,
    setShiftYx,
    setShiftYy,
    setShiftKx,
    setShiftKy,
    setTrapWidth,
    setTrapMode,
    setEdgeThreshold,
    setIsEnabled,
    setProbeR,
    setProbeG,
    setProbeB,
    setProbeGradX,
    setProbeGradY,
    applyPreset,
    toggleHUD,
    closeHUD,
    saveProfile,
  };
}
