/**
 * KuraScroll - Sprint 108: Adaptive Per-Panel Visual Acoustic Echo & Spatial Reverberation Modulator Hook
 * 
 * Hardware Target: Intel Pentium T4500 (2C/2T @ 2.30 GHz, Penryn 45nm, no AVX, heap <= 512MB) & Intel GMA 4500MHD.
 * Synthesizes zero-allocation parametric Schroeder-Moorer reverberation parameters.
 * Bound to key 'Y' / 'y' for HUD toggling.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

export type SceneEnvironment =
  | 'confined_room'
  | 'cave_echo'
  | 'outdoor_open'
  | 'cathedral_vast'
  | 'dampened_bedroom'
  | 'custom';

export interface AcousticReverbProfile {
  seriesId: string;
  sceneEnvironment: SceneEnvironment;
  roomSizeM3: number;
  absorptionCoeff: number;
  t60DecayS: number;
  dampingFreqHz: number;
  earlyReflectionsMs: number[];
  wetDryMix: number;
  isEnabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface AcousticReverbResult {
  sceneEnvironment: SceneEnvironment;
  t60DecayS: number;
  feedbackGain: number;
  dampingFreqHz: number;
  earlyReflectionTapsMs: number[];
  wetGain: number;
  dryGain: number;
  isStable: boolean;
  latencyUs: number;
}

export interface AcousticReverbPreset {
  name: SceneEnvironment;
  sceneEnvironment: SceneEnvironment;
  label: string;
  roomSizeM3: number;
  absorptionCoeff: number;
  t60DecayS: number;
  dampingFreqHz: number;
  earlyReflectionsMs: number[];
  wetDryMix: number;
  description: string;
}

export const ACOUSTIC_REVERB_PRESETS: Record<SceneEnvironment, AcousticReverbPreset> = {
  confined_room: {
    name: 'confined_room',
    sceneEnvironment: 'confined_room',
    label: 'Confined Room (Interior / Classroom)',
    roomSizeM3: 85.0,
    absorptionCoeff: 0.35,
    t60DecayS: 1.20,
    dampingFreqHz: 2800.0,
    earlyReflectionsMs: [18, 31, 47, 63],
    wetDryMix: 0.28,
    description: 'Natural indoor space with balanced wall reflections and moderate high-frequency attenuation',
  },
  cave_echo: {
    name: 'cave_echo',
    sceneEnvironment: 'cave_echo',
    label: 'Cavernous Cave & Underground Tunnel',
    roomSizeM3: 450.0,
    absorptionCoeff: 0.12,
    t60DecayS: 2.80,
    dampingFreqHz: 1800.0,
    earlyReflectionsMs: [24, 48, 72, 96],
    wetDryMix: 0.52,
    description: 'Highly reflective hard rock walls creating deep reverberant echoes and elongated tail decay',
  },
  outdoor_open: {
    name: 'outdoor_open',
    sceneEnvironment: 'outdoor_open',
    label: 'Outdoor Open Field / Rooftop',
    roomSizeM3: 1200.0,
    absorptionCoeff: 0.85,
    t60DecayS: 0.25,
    dampingFreqHz: 5500.0,
    earlyReflectionsMs: [12, 22, 35, 48],
    wetDryMix: 0.10,
    description: 'Open air acoustics with zero ceiling reflection, rapid decay, and bright high-frequency dispersion',
  },
  cathedral_vast: {
    name: 'cathedral_vast',
    sceneEnvironment: 'cathedral_vast',
    label: 'Vast Cathedral / Castle Grand Hall',
    roomSizeM3: 2500.0,
    absorptionCoeff: 0.08,
    t60DecayS: 4.20,
    dampingFreqHz: 2200.0,
    earlyReflectionsMs: [32, 64, 96, 128],
    wetDryMix: 0.65,
    description: 'Monumental acoustic volume with dense late reflections, expansive T60 tail, and majestic resonance',
  },
  dampened_bedroom: {
    name: 'dampened_bedroom',
    sceneEnvironment: 'dampened_bedroom',
    label: 'Dampened Intimate Bedroom / Library',
    roomSizeM3: 40.0,
    absorptionCoeff: 0.60,
    t60DecayS: 0.38,
    dampingFreqHz: 2100.0,
    earlyReflectionsMs: [8, 16, 24, 32],
    wetDryMix: 0.15,
    description: 'Heavily absorbed acoustic space with carpet/curtains, intimate vocal presence, and minimal reverberation',
  },
  custom: {
    name: 'custom',
    sceneEnvironment: 'custom',
    label: 'Custom User Acoustic Envelope',
    roomSizeM3: 100.0,
    absorptionCoeff: 0.30,
    t60DecayS: 1.50,
    dampingFreqHz: 3000.0,
    earlyReflectionsMs: [20, 35, 50, 70],
    wetDryMix: 0.30,
    description: 'User-calibrated Sabine reverberation parameters and custom reflection taps',
  },
};

export function localCalculateAcousticReverb(
  roomSizeM3: number = 85.0,
  absorptionCoeff: number = 0.35,
  t60DecayS: number = 1.20,
  dampingFreqHz: number = 2800.0,
  wetDryMix: number = 0.28,
  earlyReflectionsMs: number[] = [18, 31, 47, 63],
  sceneEnvironment: SceneEnvironment = 'confined_room',
  isEnabled: boolean = true
): AcousticReverbResult {
  const start = performance.now();

  const v = Math.max(5.0, Math.min(10000.0, roomSizeM3));
  const alpha = Math.max(0.01, Math.min(0.99, absorptionCoeff));
  const fc = Math.max(200.0, Math.min(20000.0, dampingFreqHz));
  const mix = Math.max(0.0, Math.min(1.0, wetDryMix));

  if (!isEnabled) {
    const end = performance.now();
    return {
      sceneEnvironment,
      t60DecayS: 0.0,
      feedbackGain: 0.0,
      dampingFreqHz: 20000.0,
      earlyReflectionTapsMs: [0, 0, 0, 0],
      wetGain: 0.0,
      dryGain: 1.0,
      isStable: true,
      latencyUs: (end - start) * 1000.0,
    };
  }

  let effectiveT60 = t60DecayS;
  if (effectiveT60 <= 0.05) {
    const surfaceArea = 6.0 * Math.pow(v, 2.0 / 3.0);
    effectiveT60 = (0.161 * v) / (surfaceArea * alpha);
  }
  effectiveT60 = Math.max(0.10, Math.min(10.0, effectiveT60));

  const dSec = 0.035;
  const rawGain = Math.pow(10.0, (-3.0 * dSec) / effectiveT60);
  const feedbackGain = Number(Math.max(0.0, Math.min(0.95, rawGain)).toFixed(4));

  const wetGain = Number(Math.sqrt(mix).toFixed(4));
  const dryGain = Number(Math.sqrt(1.0 - mix).toFixed(4));

  const taps = earlyReflectionsMs.length >= 4
    ? [
        Math.max(1, earlyReflectionsMs[0]),
        Math.max(2, earlyReflectionsMs[1]),
        Math.max(3, earlyReflectionsMs[2]),
        Math.max(4, earlyReflectionsMs[3]),
      ]
    : [18, 31, 47, 63];

  const end = performance.now();
  const latencyUs = (end - start) * 1000.0;

  return {
    sceneEnvironment,
    t60DecayS: Number(effectiveT60.toFixed(2)),
    feedbackGain,
    dampingFreqHz: fc,
    earlyReflectionTapsMs: taps,
    wetGain,
    dryGain,
    isStable: feedbackGain < 1.0,
    latencyUs,
  };
}

export function useAcousticReverb(seriesId: string = 'default-series') {
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [profile, setProfile] = useState<AcousticReverbProfile>({
    seriesId,
    ...ACOUSTIC_REVERB_PRESETS.confined_room,
    isEnabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  // Keyboard shortcut 'Y' / 'y'
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || (document.activeElement as HTMLElement)?.isContentEditable) {
        return;
      }

      if (e.key === 'y' || e.key === 'Y') {
        if (!e.ctrlKey && !e.altKey && !e.metaKey) {
          e.preventDefault();
          setIsVisible((prev) => !prev);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const result = useMemo(() => {
    return localCalculateAcousticReverb(
      profile.roomSizeM3,
      profile.absorptionCoeff,
      profile.t60DecayS,
      profile.dampingFreqHz,
      profile.wetDryMix,
      profile.earlyReflectionsMs,
      profile.sceneEnvironment,
      profile.isEnabled
    );
  }, [profile]);

  const setPreset = useCallback((presetName: SceneEnvironment) => {
    const preset = ACOUSTIC_REVERB_PRESETS[presetName];
    if (preset) {
      setProfile((prev) => ({
        ...prev,
        sceneEnvironment: preset.sceneEnvironment,
        roomSizeM3: preset.roomSizeM3,
        absorptionCoeff: preset.absorptionCoeff,
        t60DecayS: preset.t60DecayS,
        dampingFreqHz: preset.dampingFreqHz,
        earlyReflectionsMs: preset.earlyReflectionsMs,
        wetDryMix: preset.wetDryMix,
        updatedAt: Date.now(),
      }));
    }
  }, []);

  const updateProfile = useCallback((params: Partial<AcousticReverbProfile>) => {
    setProfile((prev) => ({
      ...prev,
      ...params,
      updatedAt: Date.now(),
    }));
  }, []);

  return {
    isVisible,
    setIsVisible,
    profile,
    result,
    setPreset,
    updateProfile,
  };
}
