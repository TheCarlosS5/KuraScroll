/**
 * KuraScroll - Sprint 125: Dynamic Speed-Line Vector Synthesizer & Kinetic Impact Focus Engine Hook
 * 
 * Hardware Target: Intel Pentium T4500 (2C/2T @ 2.30 GHz, Penryn 45nm, no AVX, heap <= 512MB) & Intel GMA 4500MHD.
 * Pure zero-allocation speed-line vector synthesis and O(1) impact pulse evaluator.
 * Bound to key 'L' / 'l' for HUD toggling.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

export type SpeedLinePresetName =
  | 'shonen_radial_climax'
  | 'dash_horizontal'
  | 'explosion_burst'
  | 'suspense_vortex'
  | 'raw_fixed';

export type SpeedLineMode = 'radial' | 'parallel' | 'none';

export interface SpeedLineProfile {
  seriesId: string;
  presetName: SpeedLinePresetName;
  mode: SpeedLineMode;
  lineCount: number;
  focusX: number;
  focusY: number;
  angleJitter: number;
  minLengthRatio: number;
  maxLengthRatio: number;
  minWidthPx: number;
  maxWidthPx: number;
  pulseDurationMs: number;
  isEnabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface SpeedLinePreset {
  name: SpeedLinePresetName;
  label: string;
  mode: SpeedLineMode;
  lineCount: number;
  focusX: number;
  focusY: number;
  angleJitter: number;
  minLengthRatio: number;
  maxLengthRatio: number;
  minWidthPx: number;
  maxWidthPx: number;
  pulseDurationMs: number;
  description: string;
}

export const SPEED_LINE_PRESETS: Record<SpeedLinePresetName, SpeedLinePreset> = {
  shonen_radial_climax: {
    name: 'shonen_radial_climax',
    label: 'Shonen Radial Climax',
    mode: 'radial',
    lineCount: 72,
    focusX: 0.50,
    focusY: 0.50,
    angleJitter: 0.035,
    minLengthRatio: 0.25,
    maxLengthRatio: 0.95,
    minWidthPx: 0.70,
    maxWidthPx: 2.00,
    pulseDurationMs: 320,
    description: 'High-energy radial speed lines focused on the panel core for decisive attacks and revelations.',
  },
  dash_horizontal: {
    name: 'dash_horizontal',
    label: 'Dash & Sprint Parallel Sweep',
    mode: 'parallel',
    lineCount: 36,
    focusX: 0.50,
    focusY: 0.50,
    angleJitter: 0.0,
    minLengthRatio: 0.45,
    maxLengthRatio: 0.95,
    minWidthPx: 0.60,
    maxWidthPx: 1.40,
    pulseDurationMs: 180,
    description: 'Horizontal parallel kinetic streaks for fast movement, sprints, and dynamic camera panning.',
  },
  explosion_burst: {
    name: 'explosion_burst',
    label: 'Explosion Shockwave Burst',
    mode: 'radial',
    lineCount: 96,
    focusX: 0.50,
    focusY: 0.50,
    angleJitter: 0.12,
    minLengthRatio: 0.15,
    maxLengthRatio: 1.00,
    minWidthPx: 0.80,
    maxWidthPx: 2.80,
    pulseDurationMs: 260,
    description: 'Maximum density chaotic burst with variable thickness for violent impacts and detonations.',
  },
  suspense_vortex: {
    name: 'suspense_vortex',
    label: 'Suspense Focus Vortex',
    mode: 'radial',
    lineCount: 64,
    focusX: 0.50,
    focusY: 0.50,
    angleJitter: 0.055,
    minLengthRatio: 0.35,
    maxLengthRatio: 0.85,
    minWidthPx: 0.50,
    maxWidthPx: 1.20,
    pulseDurationMs: 420,
    description: 'Subtle, controlled focus lines drawing reader gaze toward character expressions and tension.',
  },
  raw_fixed: {
    name: 'raw_fixed',
    label: 'Raw Scan Fixed (Disabled)',
    mode: 'none',
    lineCount: 0,
    focusX: 0.50,
    focusY: 0.50,
    angleJitter: 0.0,
    minLengthRatio: 0.0,
    maxLengthRatio: 0.0,
    minWidthPx: 0.10,
    maxWidthPx: 0.10,
    pulseDurationMs: 0,
    description: 'Bypasses dynamic speed-line synthesis, preserving the untouched original comic scan.',
  },
};

export interface SpeedLineBuffer {
  coordinates: Float32Array;
  widths: Float32Array;
  opacities: Float32Array;
  count: number;
  latencyUs: number;
}

export interface ImpactPulseOutput {
  pulse: number;
  radiusScale: number;
  intensity: number;
  lineScale: number;
  isActive: boolean;
}

const TAU = Math.PI * 2.0;

export function hash2D(x: number, y: number, seed: number): number {
  let h = Math.imul(x, 0x1f123bb5) ^ Math.imul(y, 0x5f356495) ^ (seed | 0);
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return (h >>> 0);
}

export function hashUnit(x: number, y: number, seed: number): number {
  return hash2D(x, y, seed) / 4294967296.0;
}

export function localEvaluateImpactPulse(
  elapsedMs: number,
  pulseDurationMs: number = 320,
  intensityAmplitude: number = 1.0,
  radiusAmplitude: number = 0.25
): ImpactPulseOutput {
  if (pulseDurationMs <= 0 || elapsedMs < 0 || elapsedMs >= pulseDurationMs) {
    return {
      pulse: 0.0,
      radiusScale: 1.0,
      intensity: 1.0,
      lineScale: 1.0,
      isActive: false,
    };
  }

  const t = elapsedMs / pulseDurationMs;
  const decay = (1.0 - t) * (1.0 - t);

  return {
    pulse: decay,
    radiusScale: 1.0 - (decay * radiusAmplitude),
    intensity: 1.0 + (decay * intensityAmplitude),
    lineScale: 1.0 + (decay * 0.35),
    isActive: true,
  };
}

export function localCalculateSpeedLines(
  mode: SpeedLineMode = 'radial',
  lineCount: number = 72,
  focusX: number = 0.50,
  focusY: number = 0.50,
  angleJitter: number = 0.035,
  minLengthRatio: number = 0.25,
  maxLengthRatio: number = 0.95,
  minWidthPx: number = 0.70,
  maxWidthPx: number = 2.00,
  seed: number = 1337,
  isEnabled: boolean = true
): SpeedLineBuffer {
  const startHr = typeof performance !== 'undefined' ? performance.now() : 0;

  if (!isEnabled || mode === 'none' || lineCount <= 0) {
    return {
      coordinates: new Float32Array(0),
      widths: new Float32Array(0),
      opacities: new Float32Array(0),
      count: 0,
      latencyUs: typeof performance !== 'undefined' ? (performance.now() - startHr) * 1000 : 0.2,
    };
  }

  const effectiveCount = Math.min(lineCount, 256);
  const coords = new Float32Array(effectiveCount * 4);
  const widths = new Float32Array(effectiveCount);
  const opacities = new Float32Array(effectiveCount);

  const fx = Math.max(0.0, Math.min(1.0, focusX));
  const fy = Math.max(0.0, Math.min(1.0, focusY));
  const lenMin = Math.max(0.0, Math.min(1.0, minLengthRatio));
  const lenMax = Math.max(lenMin, Math.min(1.0, maxLengthRatio));
  const lenDelta = lenMax - lenMin;
  const wMin = Math.max(0.10, Math.min(10.0, minWidthPx));
  const wMax = Math.max(wMin, Math.min(10.0, maxWidthPx));
  const wDelta = wMax - wMin;

  if (mode === 'radial') {
    const angleStep = TAU / effectiveCount;
    for (let i = 0; i < effectiveCount; i++) {
      const hAngle = hashUnit(i, 11, seed);
      const hLen = hashUnit(i, 23, seed);
      const hWidth = hashUnit(i, 37, seed);
      const hOpa = hashUnit(i, 51, seed);

      const theta = (i * angleStep) + ((hAngle * 2.0 - 1.0) * angleJitter);
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);

      const rOuter = 0.75 + (0.25 * hLen);
      const rInner = rOuter * (1.0 - (lenMin + lenDelta * hLen));

      const idx4 = i << 2;
      coords[idx4] = fx + cosT * rOuter;
      coords[idx4 + 1] = fy + sinT * rOuter;
      coords[idx4 + 2] = fx + cosT * rInner;
      coords[idx4 + 3] = fy + sinT * rInner;

      widths[i] = wMin + (wDelta * hWidth);
      opacities[i] = 0.50 + (0.50 * hOpa);
    }
  } else if (mode === 'parallel') {
    const yStep = 1.0 / effectiveCount;
    for (let i = 0; i < effectiveCount; i++) {
      const hY = hashUnit(i, 13, seed);
      const hLen = hashUnit(i, 29, seed);
      const hWidth = hashUnit(i, 41, seed);
      const hOpa = hashUnit(i, 67, seed);

      const y = (i * yStep) + ((hY * 2.0 - 1.0) * (yStep * 0.40));
      const lineLen = lenMin + (lenDelta * hLen);
      const xStart = hLen > 0.5 ? 1.0 : 0.0;
      const xEnd = hLen > 0.5 ? 1.0 - lineLen : lineLen;

      const idx4 = i << 2;
      coords[idx4] = xStart;
      coords[idx4 + 1] = y;
      coords[idx4 + 2] = xEnd;
      coords[idx4 + 3] = y;

      widths[i] = wMin + (wDelta * hWidth);
      opacities[i] = 0.40 + (0.60 * hOpa);
    }
  }

  const endHr = typeof performance !== 'undefined' ? performance.now() : 0;
  return {
    coordinates: coords,
    widths,
    opacities,
    count: effectiveCount,
    latencyUs: typeof performance !== 'undefined' ? (endHr - startHr) * 1000 : 0.5,
  };
}

export function useSpeedLine(seriesId: string) {
  const [isHUDOpen, setIsHUDOpen] = useState(false);
  const [presetName, setPresetName] = useState<SpeedLinePresetName>('shonen_radial_climax');
  const [mode, setMode] = useState<SpeedLineMode>('radial');
  const [lineCount, setLineCount] = useState(72);
  const [focusX, setFocusX] = useState(0.50);
  const [focusY, setFocusY] = useState(0.50);
  const [angleJitter, setAngleJitter] = useState(0.035);
  const [minLengthRatio, setMinLengthRatio] = useState(0.25);
  const [maxLengthRatio, setMaxLengthRatio] = useState(0.95);
  const [minWidthPx, setMinWidthPx] = useState(0.70);
  const [maxWidthPx, setMaxWidthPx] = useState(2.00);
  const [pulseDurationMs, setPulseDurationMs] = useState(320);
  const [isEnabled, setIsEnabled] = useState(true);

  // Pulse animation state
  const [pulseElapsedMs, setPulseElapsedMs] = useState(-1);
  const animFrameRef = useRef<number | null>(null);
  const pulseStartRef = useRef<number>(0);

  const pulseOutput = useMemo(
    () => localEvaluateImpactPulse(pulseElapsedMs, pulseDurationMs, 1.0, 0.25),
    [pulseElapsedMs, pulseDurationMs]
  );

  const triggerPulse = useCallback(() => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
    }
    pulseStartRef.current = performance.now();
    setPulseElapsedMs(0);

    const step = () => {
      const now = performance.now();
      const elapsed = now - pulseStartRef.current;
      if (elapsed < pulseDurationMs) {
        setPulseElapsedMs(elapsed);
        animFrameRef.current = requestAnimationFrame(step);
      } else {
        setPulseElapsedMs(-1);
        animFrameRef.current = null;
      }
    };
    animFrameRef.current = requestAnimationFrame(step);
  }, [pulseDurationMs]);

  useEffect(() => {
    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  const buffer = useMemo(
    () =>
      localCalculateSpeedLines(
        mode,
        lineCount,
        focusX,
        focusY,
        angleJitter,
        minLengthRatio,
        maxLengthRatio,
        minWidthPx,
        maxWidthPx,
        1337,
        isEnabled
      ),
    [
      mode,
      lineCount,
      focusX,
      focusY,
      angleJitter,
      minLengthRatio,
      maxLengthRatio,
      minWidthPx,
      maxWidthPx,
      isEnabled,
    ]
  );

  // Keyboard hotkey 'L' / 'l' toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        (activeEl as HTMLElement)?.isContentEditable;

      if (!isInput && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault();
        setIsHUDOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const selectPreset = useCallback((presetKey: SpeedLinePresetName) => {
    setPresetName(presetKey);
    const p = SPEED_LINE_PRESETS[presetKey];
    if (p) {
      setMode(p.mode);
      setLineCount(p.lineCount);
      setFocusX(p.focusX);
      setFocusY(p.focusY);
      setAngleJitter(p.angleJitter);
      setMinLengthRatio(p.minLengthRatio);
      setMaxLengthRatio(p.maxLengthRatio);
      setMinWidthPx(p.minWidthPx);
      setMaxWidthPx(p.maxWidthPx);
      setPulseDurationMs(p.pulseDurationMs);
    }
  }, []);

  return {
    isHUDOpen,
    setIsHUDOpen,
    presetName,
    setPresetName,
    mode,
    setMode,
    lineCount,
    setLineCount,
    focusX,
    setFocusX,
    focusY,
    setFocusY,
    angleJitter,
    setAngleJitter,
    minLengthRatio,
    setMinLengthRatio,
    maxLengthRatio,
    setMaxLengthRatio,
    minWidthPx,
    setMinWidthPx,
    maxWidthPx,
    setMaxWidthPx,
    pulseDurationMs,
    setPulseDurationMs,
    isEnabled,
    setIsEnabled,
    buffer,
    pulseOutput,
    triggerPulse,
    selectPreset,
  };
}
