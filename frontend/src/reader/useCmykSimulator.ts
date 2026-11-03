/**
 * KuraScroll - Sprint 128: Perceptual Color Gamut Mapping & CMYK Ink Density Simulator Hook
 * 
 * Hardware Target: Intel Pentium T4500 (2C/2T @ 2.30 GHz, Penryn 45nm, no AVX, heap <= 512MB) & Intel GMA 4500MHD.
 * Zero-allocation closed-form CMYK separation, dot gain expansion, and TAC clamping.
 * Bound to key 'Shift + C' for HUD toggling.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

export type CmykSimulatorPresetName =
  | 'shonen_color_spread'
  | 'tankobon_four_color'
  | 'vintage_faded_pulp'
  | 'cyberpunk_cmyk_boost'
  | 'raw_fixed';

export interface CmykSimulatorProfile {
  seriesId: string;
  presetName: CmykSimulatorPresetName;
  tacLimit: number;
  dotGain: number;
  blackAbsorption: number;
  gamutCompression: number;
  isEnabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface CmykSimulatorPreset {
  name: CmykSimulatorPresetName;
  label: string;
  tacLimit: number;
  dotGain: number;
  blackAbsorption: number;
  gamutCompression: number;
  description: string;
}

export const CMYK_SIMULATOR_PRESETS: Record<CmykSimulatorPresetName, CmykSimulatorPreset> = {
  shonen_color_spread: {
    name: 'shonen_color_spread',
    label: 'Shōnen Color Centerfold',
    tacLimit: 3.00,
    dotGain: 0.12,
    blackAbsorption: 0.15,
    gamutCompression: 0.10,
    description: 'High-contrast vibrant rotary press simulation for Japanese magazine centerfolds and climax splash spreads.',
  },
  tankobon_four_color: {
    name: 'tankobon_four_color',
    label: 'Tankōbon Standard 4-Color',
    tacLimit: 2.80,
    dotGain: 0.10,
    blackAbsorption: 0.10,
    gamutCompression: 0.15,
    description: 'Balanced commercial CMYK process printing with moderate dot gain and standardized TAC coverage.',
  },
  vintage_faded_pulp: {
    name: 'vintage_faded_pulp',
    label: 'Vintage Faded Pulp Print',
    tacLimit: 2.40,
    dotGain: 0.20,
    blackAbsorption: 0.25,
    gamutCompression: 0.30,
    description: 'Porous newsprint texture with pronounced mechanical dot spread, ink absorption bleed, and soft gamut rolloff.',
  },
  cyberpunk_cmyk_boost: {
    name: 'cyberpunk_cmyk_boost',
    label: 'Cyberpunk Extended Gamut',
    tacLimit: 3.20,
    dotGain: 0.05,
    blackAbsorption: 0.05,
    gamutCompression: 0.05,
    description: 'Maximized ink saturation with expanded TAC headroom for neon-lit sci-fi and modern webtoon illustrations.',
  },
  raw_fixed: {
    name: 'raw_fixed',
    label: 'Raw Pass-Through (Disabled)',
    tacLimit: 4.00,
    dotGain: 0.0,
    blackAbsorption: 0.0,
    gamutCompression: 0.0,
    description: 'Bypasses CMYK physical ink separation and passes pristine sRGB digital colors untouched.',
  },
};

export interface CmykSimulationResult {
  inR: number;
  inG: number;
  inB: number;
  cyan: number;
  magenta: number;
  yellow: number;
  black: number;
  totalAreaCoverage: number;
  isTacClamped: boolean;
  outR: number;
  outG: number;
  outB: number;
  latencyUs: number;
}

export function localCalculateCmykSimulation(
  r: number,
  g: number,
  b: number,
  tacLimit: number = 2.80,
  dotGain: number = 0.10,
  blackAbsorption: number = 0.10,
  gamutCompression: number = 0.15,
  isEnabled: boolean = true
): CmykSimulationResult {
  const startHr = typeof performance !== 'undefined' ? performance.now() : 0;

  if (!isEnabled) {
    return {
      inR: r,
      inG: g,
      inB: b,
      cyan: 0,
      magenta: 0,
      yellow: 0,
      black: 0,
      totalAreaCoverage: 0,
      isTacClamped: false,
      outR: r,
      outG: g,
      outB: b,
      latencyUs: typeof performance !== 'undefined' ? (performance.now() - startHr) * 1000 : 0.2,
    };
  }

  const rn = r <= 0 ? 0 : r >= 255 ? 1 : r / 255.0;
  const gn = g <= 0 ? 0 : g >= 255 ? 1 : g / 255.0;
  const bn = b <= 0 ? 0 : b >= 255 ? 1 : b / 255.0;

  const maxRgb = rn > gn ? (rn > bn ? rn : bn) : (gn > bn ? gn : bn);
  let k = 1.0 - maxRgb;
  let c = 0;
  let m = 0;
  let y = 0;

  if (k >= 0.999) {
    k = 1.0;
    c = 0;
    m = 0;
    y = 0;
  } else {
    const invK = 1.0 / (1.0 - k);
    c = (1.0 - rn - k) * invK;
    m = (1.0 - gn - k) * invK;
    y = (1.0 - bn - k) * invK;
  }

  let cEff = c + dotGain * c * (1.0 - c);
  let mEff = m + dotGain * m * (1.0 - m);
  let yEff = y + dotGain * y * (1.0 - y);
  let kEff = k + dotGain * k * (1.0 - k);

  cEff *= (1.0 - blackAbsorption * kEff);
  mEff *= (1.0 - blackAbsorption * kEff);
  yEff *= (1.0 - blackAbsorption * kEff);

  const tac = cEff + mEff + yEff + kEff;
  let isTacClamped = false;
  if (tac > tacLimit && tac > 0.001) {
    const q = tacLimit / tac;
    cEff *= q;
    mEff *= q;
    yEff *= q;
    kEff *= q;
    isTacClamped = true;
  }

  let rRec = (1.0 - cEff) * (1.0 - kEff);
  let gRec = (1.0 - mEff) * (1.0 - kEff);
  let bRec = (1.0 - yEff) * (1.0 - kEff);

  if (gamutCompression > 0) {
    const yLum = 0.2126 * rRec + 0.7152 * gRec + 0.0722 * bRec;
    const dR = rRec - yLum;
    const dG = gRec - yLum;
    const dB = bRec - yLum;
    const compScale = 1.0 - gamutCompression * 0.40;
    rRec = yLum + dR * compScale;
    gRec = yLum + dG * compScale;
    bRec = yLum + dB * compScale;
  }

  const outR = Math.round(Math.max(0, Math.min(1, rRec)) * 255);
  const outG = Math.round(Math.max(0, Math.min(1, gRec)) * 255);
  const outB = Math.round(Math.max(0, Math.min(1, bRec)) * 255);

  const endHr = typeof performance !== 'undefined' ? performance.now() : 0;

  return {
    inR: r,
    inG: g,
    inB: b,
    cyan: Math.round(cEff * 1000) / 1000,
    magenta: Math.round(mEff * 1000) / 1000,
    yellow: Math.round(yEff * 1000) / 1000,
    black: Math.round(kEff * 1000) / 1000,
    totalAreaCoverage: Math.round((cEff + mEff + yEff + kEff) * 1000) / 1000,
    isTacClamped,
    outR,
    outG,
    outB,
    latencyUs: typeof performance !== 'undefined' ? (endHr - startHr) * 1000 : 0.4,
  };
}

export function useCmykSimulator(seriesId: string) {
  const [isHUDOpen, setIsHUDOpen] = useState(false);
  const [presetName, setPresetName] = useState<CmykSimulatorPresetName>('tankobon_four_color');
  const [tacLimit, setTacLimit] = useState(2.80);
  const [dotGain, setDotGain] = useState(0.10);
  const [blackAbsorption, setBlackAbsorption] = useState(0.10);
  const [gamutCompression, setGamutCompression] = useState(0.15);
  const [isEnabled, setIsEnabled] = useState(true);

  // Probe inputs for live simulator
  const [probeR, setProbeR] = useState(210);
  const [probeG, setProbeG] = useState(85);
  const [probeB, setProbeB] = useState(45);

  const currentResult = useMemo(
    () =>
      localCalculateCmykSimulation(
        probeR,
        probeG,
        probeB,
        tacLimit,
        dotGain,
        blackAbsorption,
        gamutCompression,
        isEnabled
      ),
    [
      probeR,
      probeG,
      probeB,
      tacLimit,
      dotGain,
      blackAbsorption,
      gamutCompression,
      isEnabled,
    ]
  );

  // Keyboard hotkey 'Shift + C' toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        (activeEl as HTMLElement)?.isContentEditable;

      if (!isInput && e.shiftKey && (e.key === 'C' || e.key === 'c')) {
        e.preventDefault();
        setIsHUDOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const selectPreset = useCallback((presetKey: CmykSimulatorPresetName) => {
    setPresetName(presetKey);
    const p = CMYK_SIMULATOR_PRESETS[presetKey];
    if (p) {
      setTacLimit(p.tacLimit);
      setDotGain(p.dotGain);
      setBlackAbsorption(p.blackAbsorption);
      setGamutCompression(p.gamutCompression);
    }
  }, []);

  return {
    isHUDOpen,
    setIsHUDOpen,
    presetName,
    setPresetName,
    tacLimit,
    setTacLimit,
    dotGain,
    setDotGain,
    blackAbsorption,
    setBlackAbsorption,
    gamutCompression,
    setGamutCompression,
    isEnabled,
    setIsEnabled,
    probeR,
    setProbeR,
    probeG,
    setProbeG,
    probeB,
    setProbeB,
    currentResult,
    selectPreset,
  };
}
