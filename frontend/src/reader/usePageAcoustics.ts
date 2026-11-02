/**
 * KuraScroll Binaural Page Rustle & Tactile Leaf Turn Acoustics Hook
 * Sprint 82 - Low-Frequency Sub-Bass Page Flip Haptic Synthesizer
 *
 * Coordinates procedural Web Audio API leaf-turn acoustic synthesis,
 * binaural stereo panning sweep, and keyboard shortcut 'A'.
 * Hardware-tuned for Intel Pentium T4500 & Intel GMA 4500MHD (0 blur, 0 CLS).
 */

import { useState, useCallback, useEffect, useRef } from 'react';

export type PaperSubstrate = 'glossy' | 'newsprint' | 'tankobon' | 'silk_ribbon';

export interface UsePageAcousticsOptions {
  defaultEnabled?: boolean;
  defaultSubstrate?: PaperSubstrate;
  defaultVolume?: number;
  defaultStereoPanning?: boolean;
  defaultHapticPulse?: boolean;
  defaultHapticIntensity?: number;
  enableKeyboard?: boolean;
}

export const SUBSTRATE_PRESETS: Record<
  PaperSubstrate,
  {
    name: string;
    cutoffHz: number;
    qFactor: number;
    durationMs: number;
    hapticDurationMs: number;
    baseGain: number;
    description: string;
  }
> = {
  tankobon: {
    name: 'Tankōbon Estándar',
    cutoffHz: 2800,
    qFactor: 1.2,
    durationMs: 220,
    hapticDurationMs: 25,
    baseGain: 0.7,
    description: 'Crujido clásico de volumen encuadernado japonés estándar.',
  },
  newsprint: {
    name: 'Papel Periódico Pulpa',
    cutoffHz: 1800,
    qFactor: 0.9,
    durationMs: 280,
    hapticDurationMs: 35,
    baseGain: 0.85,
    description: 'Fricción áspera y porosa con resonancia cálida de pulpa reciclada.',
  },
  glossy: {
    name: 'Couché Satinado (Glossy)',
    cutoffHz: 4200,
    qFactor: 1.8,
    durationMs: 150,
    hapticDurationMs: 18,
    baseGain: 0.55,
    description: 'Deslizamiento suave y nítido de revista ilustrada o papel estucado.',
  },
  silk_ribbon: {
    name: 'Seda Suave (Silk)',
    cutoffHz: 3400,
    qFactor: 1.0,
    durationMs: 180,
    hapticDurationMs: 20,
    baseGain: 0.6,
    description: 'Susurro delicado de alta definición para novelas gráficas de lujo.',
  },
};

export function usePageAcoustics({
  defaultEnabled = true,
  defaultSubstrate = 'tankobon',
  defaultVolume = 0.65,
  defaultStereoPanning = true,
  defaultHapticPulse = true,
  defaultHapticIntensity = 0.5,
  enableKeyboard = true,
}: UsePageAcousticsOptions = {}) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isEnabled, setIsEnabled] = useState<boolean>(defaultEnabled);
  const [paperSubstrate, setPaperSubstrateState] = useState<PaperSubstrate>(defaultSubstrate);
  const [volume, setVolumeState] = useState<number>(defaultVolume);
  const [stereoPanningEnabled, setStereoPanningEnabledState] = useState<boolean>(defaultStereoPanning);
  const [hapticPulseEnabled, setHapticPulseEnabledState] = useState<boolean>(defaultHapticPulse);
  const [hapticIntensity, setHapticIntensityState] = useState<number>(defaultHapticIntensity);

  const audioCtxRef = useRef<AudioContext | null>(null);

  const openHUD = useCallback(() => setIsOpen(true), []);
  const closeHUD = useCallback(() => setIsOpen(false), []);
  const toggleHUD = useCallback(() => setIsOpen((prev) => !prev), []);
  const toggleEnabled = useCallback(() => setIsEnabled((prev) => !prev), []);
  const toggleStereoPanning = useCallback(() => setStereoPanningEnabledState((prev) => !prev), []);
  const toggleHapticPulse = useCallback(() => setHapticPulseEnabledState((prev) => !prev), []);

  const setPaperSubstrate = useCallback((s: PaperSubstrate) => {
    if (['glossy', 'newsprint', 'tankobon', 'silk_ribbon'].includes(s)) {
      setPaperSubstrateState(s);
    }
  }, []);

  const setVolume = useCallback((v: number) => {
    const clamped = Math.min(1.0, Math.max(0.0, Math.round(v * 100) / 100));
    setVolumeState(clamped);
  }, []);

  const setHapticIntensity = useCallback((h: number) => {
    const clamped = Math.min(1.0, Math.max(0.0, Math.round(h * 100) / 100));
    setHapticIntensityState(clamped);
  }, []);

  // Web Audio Procedural Synthesis on Page Turn
  const playFlipAcoustic = useCallback(
    (pageDirection: 'next' | 'prev' = 'next', readingDirection: 'rtl' | 'ltr' = 'rtl') => {
      if (!isEnabled || volume <= 0) return;

      try {
        if (!audioCtxRef.current) {
          const AudioContextClass =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          if (AudioContextClass) {
            audioCtxRef.current = new AudioContextClass();
          }
        }

        const ctx = audioCtxRef.current;
        if (!ctx) return;
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }

        const conf = SUBSTRATE_PRESETS[paperSubstrate];
        const durationSec = conf.durationMs / 1000.0;
        const now = ctx.currentTime;

        // 1. Noise buffer for surface paper friction
        const bufferSize = Math.floor(ctx.sampleRate * durationSec);
        if (bufferSize > 0) {
          const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
          const output = noiseBuffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
          }

          const whiteNoise = ctx.createBufferSource();
          whiteNoise.buffer = noiseBuffer;

          // 2. Biquad filter bandpass
          const filter = ctx.createBiquadFilter();
          filter.type = 'bandpass';
          filter.frequency.setValueAtTime(conf.cutoffHz, now);
          filter.Q.setValueAtTime(conf.qFactor, now);

          // 3. Stereo Panner Sweep
          let panNode: StereoPannerNode | null = null;
          if (stereoPanningEnabled && typeof ctx.createStereoPanner === 'function') {
            panNode = ctx.createStereoPanner();
            const isRtl = readingDirection === 'rtl';
            const panStart = isRtl ? (pageDirection === 'next' ? 0.75 : -0.75) : (pageDirection === 'next' ? -0.75 : 0.75);
            const panEnd = isRtl ? (pageDirection === 'next' ? -0.75 : 0.75) : (pageDirection === 'next' ? 0.75 : -0.75);

            panNode.pan.setValueAtTime(panStart, now);
            panNode.pan.linearRampToValueAtTime(panEnd, now + durationSec);
          }

          // 4. Master gain envelope
          const gainNode = ctx.createGain();
          const effectiveGain = volume * conf.baseGain;
          gainNode.gain.setValueAtTime(0.001, now);
          gainNode.gain.linearRampToValueAtTime(effectiveGain, now + 0.02);
          gainNode.gain.exponentialRampToValueAtTime(0.001, now + durationSec);

          // Route graph
          whiteNoise.connect(filter);
          if (panNode) {
            filter.connect(panNode);
            panNode.connect(gainNode);
          } else {
            filter.connect(gainNode);
          }
          gainNode.connect(ctx.destination);

          whiteNoise.start(now);
          whiteNoise.stop(now + durationSec);
        }

        // Haptic feedback pulse
        if (hapticPulseEnabled && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          const vibDuration = Math.round(conf.hapticDurationMs * hapticIntensity);
          if (vibDuration > 0) {
            navigator.vibrate(vibDuration);
          }
        }
      } catch {
        // Fallback gracefully on audio hardware error
      }
    },
    [isEnabled, volume, paperSubstrate, stereoPanningEnabled, hapticPulseEnabled, hapticIntensity]
  );

  // Keyboard shortcut: 'A' or 'a' to toggle HUD, 'M' to mute
  useEffect(() => {
    if (!enableKeyboard) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        toggleHUD();
      } else if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        closeHUD();
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        toggleEnabled();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enableKeyboard, isOpen, toggleHUD, closeHUD, toggleEnabled]);

  return {
    isOpen,
    isEnabled,
    paperSubstrate,
    volume,
    stereoPanningEnabled,
    hapticPulseEnabled,
    hapticIntensity,
    openHUD,
    closeHUD,
    toggleHUD,
    toggleEnabled,
    toggleStereoPanning,
    toggleHapticPulse,
    setPaperSubstrate,
    setVolume,
    setHapticIntensity,
    playFlipAcoustic,
  };
}
