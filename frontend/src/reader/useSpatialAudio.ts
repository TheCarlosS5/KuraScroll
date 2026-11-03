/**
 * KuraScroll - Sprint 120: Spatial Audio Reverberation Occlusion & Distance Attenuation Engine Hook
 * 
 * Hardware Target: Intel Pentium T4500 (2C/2T @ 2.30 GHz, Penryn 45nm, no AVX, heap <= 512MB) & Intel GMA 4500MHD.
 * Pure zero-allocation spatial acoustic attenuation and equal-power stereo panning law.
 * Bound to key 'O' / 'o' for HUD toggling.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

export type SpatialAudioPresetName =
  | 'dialogue_near'
  | 'dialogue_occluded'
  | 'indoor_scene'
  | 'action_impact'
  | 'webtoon_vertical_flow';

export interface SpatialAudioProfile {
  seriesId: string;
  presetName: SpatialAudioPresetName;
  referenceDistancePx: number;
  rolloffFactor: number;
  minGain: number;
  maxDistancePx: number;
  panRadiusPx: number;
  cutoffOpenHz: number;
  cutoffClosedHz: number;
  filterQ: number;
  isEnabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface SpatialAudioPreset {
  name: SpatialAudioPresetName;
  label: string;
  referenceDistancePx: number;
  rolloffFactor: number;
  minGain: number;
  maxDistancePx: number;
  panRadiusPx: number;
  cutoffOpenHz: number;
  cutoffClosedHz: number;
  filterQ: number;
  description: string;
}

export const SPATIAL_AUDIO_PRESETS: Record<SpatialAudioPresetName, SpatialAudioPreset> = {
  dialogue_near: {
    name: 'dialogue_near',
    label: 'Dialogue Near (Direct Line of Sight)',
    referenceDistancePx: 120.0,
    rolloffFactor: 1.0,
    minGain: 0.025,
    maxDistancePx: 1400.0,
    panRadiusPx: 480.0,
    cutoffOpenHz: 18000.0,
    cutoffClosedHz: 2500.0,
    filterQ: 0.707,
    description: 'Crisp open speech on current active panel without acoustic obstruction.',
  },
  dialogue_occluded: {
    name: 'dialogue_occluded',
    label: 'Dialogue Occluded (Gutter Barrier)',
    referenceDistancePx: 120.0,
    rolloffFactor: 1.0,
    minGain: 0.025,
    maxDistancePx: 1400.0,
    panRadiusPx: 480.0,
    cutoffOpenHz: 18000.0,
    cutoffClosedHz: 1200.0,
    filterQ: 0.707,
    description: 'Muffled dialogue obscured by dense panel gutters or speech behind objects.',
  },
  indoor_scene: {
    name: 'indoor_scene',
    label: 'Indoor Scene Reverb Room',
    referenceDistancePx: 160.0,
    rolloffFactor: 1.1,
    minGain: 0.025,
    maxDistancePx: 1400.0,
    panRadiusPx: 480.0,
    cutoffOpenHz: 14000.0,
    cutoffClosedHz: 1800.0,
    filterQ: 0.707,
    description: 'Enclosed room acoustics with gentle high-frequency absorption.',
  },
  action_impact: {
    name: 'action_impact',
    label: 'Action Shonen Impact SFX',
    referenceDistancePx: 180.0,
    rolloffFactor: 0.9,
    minGain: 0.020,
    maxDistancePx: 1600.0,
    panRadiusPx: 520.0,
    cutoffOpenHz: 18000.0,
    cutoffClosedHz: 900.0,
    filterQ: 0.707,
    description: 'Wide dynamic range explosive SFX with deep bass rumble when occluded.',
  },
  webtoon_vertical_flow: {
    name: 'webtoon_vertical_flow',
    label: 'Continuous Webtoon Vertical Flow',
    referenceDistancePx: 100.0,
    rolloffFactor: 1.25,
    minGain: 0.025,
    maxDistancePx: 1800.0,
    panRadiusPx: 400.0,
    cutoffOpenHz: 16000.0,
    cutoffClosedHz: 2000.0,
    filterQ: 0.707,
    description: 'Optimized for tall scrolling vertical ribbons with rapid vertical attenuation.',
  },
};

export interface SpatialAudioResult {
  distancePx: number;
  attenuation: number;
  gainLeft: number;
  gainRight: number;
  cutoffHz: number;
  panning: number;
  latencyUs: number;
}

const PI_OVER_4 = Math.PI / 4.0;

export function localCalculateSpatialAudio(
  sourceX: number,
  sourceY: number,
  listenerX: number,
  listenerY: number,
  occlusionFactor: number = 0.0,
  referenceDistancePx: number = 120.0,
  rolloffFactor: number = 1.0,
  minGain: number = 0.025,
  maxDistancePx: number = 1400.0,
  panRadiusPx: number = 480.0,
  cutoffOpenHz: number = 18000.0,
  cutoffClosedHz: number = 2500.0,
  isEnabled: boolean = true
): SpatialAudioResult {
  const startHr = typeof performance !== 'undefined' ? performance.now() : 0;

  if (!isEnabled) {
    return {
      distancePx: 0.0,
      attenuation: 1.0,
      gainLeft: 0.7071,
      gainRight: 0.7071,
      cutoffHz: cutoffOpenHz,
      panning: 0.0,
      latencyUs: typeof performance !== 'undefined' ? (performance.now() - startHr) * 1000 : 0.2,
    };
  }

  // 1. Distance Calculation (Euclidean)
  const dx = sourceX - listenerX;
  const dy = sourceY - listenerY;
  const distanceSq = dx * dx + dy * dy;
  const distance = Math.min(maxDistancePx, Math.sqrt(distanceSq));

  // 2. Inverse Distance Attenuation Model
  const excessDist = Math.max(0.0, distance - referenceDistancePx);
  const rawAttenuation = referenceDistancePx / (referenceDistancePx + rolloffFactor * excessDist);
  const attenuation = Math.max(minGain, Math.min(1.0, rawAttenuation));

  // 3. Occlusion Lowpass Biquad Filter Cutoff (Logarithmic interpolation)
  const clampedOcc = Math.max(0.0, Math.min(1.0, occlusionFactor));
  let cutoffHz = cutoffOpenHz;
  if (clampedOcc > 0.0 && cutoffClosedHz < cutoffOpenHz) {
    const freqRatio = cutoffOpenHz / cutoffClosedHz;
    cutoffHz = cutoffClosedHz * Math.pow(freqRatio, 1.0 - clampedOcc);
    if (cutoffHz < cutoffClosedHz) cutoffHz = cutoffClosedHz;
    if (cutoffHz > cutoffOpenHz) cutoffHz = cutoffOpenHz;
  }

  // 4. Equal-Power Stereo Panning Law
  const p = Math.max(-1.0, Math.min(1.0, dx / Math.max(10.0, panRadiusPx)));
  const theta = (p + 1.0) * PI_OVER_4; // [0, PI/2]
  const gainLeft = Math.cos(theta) * attenuation;
  const gainRight = Math.sin(theta) * attenuation;

  const endHr = typeof performance !== 'undefined' ? performance.now() : 0;

  return {
    distancePx: distance,
    attenuation,
    gainLeft,
    gainRight,
    cutoffHz,
    panning: p,
    latencyUs: typeof performance !== 'undefined' ? (endHr - startHr) * 1000 : 0.2,
  };
}

export function useSpatialAudio(seriesId: string) {
  const [isHUDOpen, setIsHUDOpen] = useState(false);
  const [presetName, setPresetName] = useState<SpatialAudioPresetName>('dialogue_near');
  const [referenceDistancePx, setReferenceDistancePx] = useState(120.0);
  const [rolloffFactor, setRolloffFactor] = useState(1.0);
  const [minGain, setMinGain] = useState(0.025);
  const [maxDistancePx, setMaxDistancePx] = useState(1400.0);
  const [panRadiusPx, setPanRadiusPx] = useState(480.0);
  const [cutoffOpenHz, setCutoffOpenHz] = useState(18000.0);
  const [cutoffClosedHz, setCutoffClosedHz] = useState(2500.0);
  const [filterQ, setFilterQ] = useState(0.707);
  const [isEnabled, setIsEnabled] = useState(true);

  // Dynamic sound source and listener positions for interactive radar
  const [sourcePos, setSourcePos] = useState({ x: 300, y: 150 });
  const [listenerPos, setListenerPos] = useState({ x: 200, y: 200 });
  const [occlusionFactor, setOcclusionFactor] = useState(0.25);

  const currentResult = useMemo(
    () =>
      localCalculateSpatialAudio(
        sourcePos.x,
        sourcePos.y,
        listenerPos.x,
        listenerPos.y,
        occlusionFactor,
        referenceDistancePx,
        rolloffFactor,
        minGain,
        maxDistancePx,
        panRadiusPx,
        cutoffOpenHz,
        cutoffClosedHz,
        isEnabled
      ),
    [
      sourcePos,
      listenerPos,
      occlusionFactor,
      referenceDistancePx,
      rolloffFactor,
      minGain,
      maxDistancePx,
      panRadiusPx,
      cutoffOpenHz,
      cutoffClosedHz,
      isEnabled,
    ]
  );

  // Keyboard hotkey 'O' / 'o' toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        (activeEl as HTMLElement)?.isContentEditable;

      if (!isInput && (e.key === 'o' || e.key === 'O')) {
        e.preventDefault();
        setIsHUDOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const selectPreset = useCallback((presetKey: SpatialAudioPresetName) => {
    setPresetName(presetKey);
    const p = SPATIAL_AUDIO_PRESETS[presetKey];
    if (p) {
      setReferenceDistancePx(p.referenceDistancePx);
      setRolloffFactor(p.rolloffFactor);
      setMinGain(p.minGain);
      setMaxDistancePx(p.maxDistancePx);
      setPanRadiusPx(p.panRadiusPx);
      setCutoffOpenHz(p.cutoffOpenHz);
      setCutoffClosedHz(p.cutoffClosedHz);
      setFilterQ(p.filterQ);
    }
  }, []);

  return {
    isHUDOpen,
    setIsHUDOpen,
    presetName,
    setPresetName,
    referenceDistancePx,
    setReferenceDistancePx,
    rolloffFactor,
    setRolloffFactor,
    minGain,
    setMinGain,
    maxDistancePx,
    setMaxDistancePx,
    panRadiusPx,
    setPanRadiusPx,
    cutoffOpenHz,
    setCutoffOpenHz,
    cutoffClosedHz,
    setCutoffClosedHz,
    filterQ,
    setFilterQ,
    isEnabled,
    setIsEnabled,
    sourcePos,
    setSourcePos,
    listenerPos,
    setListenerPos,
    occlusionFactor,
    setOcclusionFactor,
    currentResult,
    selectPreset,
  };
}
