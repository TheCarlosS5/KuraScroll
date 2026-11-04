/**
 * KuraScroll Multi-Track Ambient Soundscapes Hook
 * Sprint 73 - Atmospheric Soundscapes & BGM Mixer Engine
 *
 * Manages master volume, per-track volumes, play/pause states, mute toggles,
 * and HUD visibility with keyboard shortcut 'B'.
 * Hardware-tuned for Intel Pentium T4500 & Intel GMA 4500MHD (0 blur, 0 CLS).
 */

import { useState, useCallback, useEffect } from 'react';

export type SoundscapeTrackId = 'rain' | 'campfire' | 'wind' | 'tavern' | 'mystery' | 'lofi_zen';

export interface SoundscapeTrack {
  id: SoundscapeTrackId;
  name: string;
  icon: string;
  volume: number; // 0 to 100
  isPlaying: boolean;
}

export const INITIAL_SOUNDSCAPE_TRACKS: SoundscapeTrack[] = [
  { id: 'rain', name: 'Lluvia en Ventana', icon: 'rain', volume: 60, isPlaying: false },
  { id: 'campfire', name: 'Hoguera & Campamento', icon: 'campfire', volume: 50, isPlaying: false },
  { id: 'wind', name: 'Viento & Niebla', icon: 'wind', volume: 40, isPlaying: false },
  { id: 'tavern', name: 'Taberna Medieval', icon: 'tavern', volume: 50, isPlaying: false },
  { id: 'mystery', name: 'Misterio & Susurros', icon: 'mystery', volume: 45, isPlaying: false },
  { id: 'lofi_zen', name: 'Lo-Fi Zen Study', icon: 'lofi_zen', volume: 55, isPlaying: false },
];

export interface UseAmbientSoundscapeOptions {
  userId?: string;
  defaultMasterVolume?: number; // 0-100
  defaultIsMuted?: boolean;
  initialTracks?: SoundscapeTrack[];
  enableKeyboard?: boolean;
}

export function useAmbientSoundscape({
  userId = 'default_user',
  defaultMasterVolume = 70,
  defaultIsMuted = false,
  initialTracks = INITIAL_SOUNDSCAPE_TRACKS,
  enableKeyboard = true,
}: UseAmbientSoundscapeOptions = {}) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [masterVolume, setMasterVolumeState] = useState<number>(defaultMasterVolume);
  const [isMuted, setIsMuted] = useState<boolean>(defaultIsMuted);
  const [tracks, setTracks] = useState<SoundscapeTrack[]>(initialTracks);

  const openHUD = useCallback(() => setIsOpen(true), []);
  const closeHUD = useCallback(() => setIsOpen(false), []);
  const toggleHUD = useCallback(() => setIsOpen((prev) => !prev), []);

  const toggleMasterMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  const setMasterVolume = useCallback((vol: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(vol)));
    setMasterVolumeState(clamped);
    if (clamped > 0 && isMuted) {
      setIsMuted(false);
    }
  }, [isMuted]);

  const setTrackVolume = useCallback((trackId: SoundscapeTrackId, vol: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(vol)));
    setTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, volume: clamped } : t))
    );
  }, []);

  const toggleTrackPlay = useCallback((trackId: SoundscapeTrackId) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, isPlaying: !t.isPlaying } : t))
    );
  }, []);

  // Global keyboard shortcut ('B' or 'b') to toggle soundscape HUD
  useEffect(() => {
    if (!enableKeyboard) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enableKeyboard]);

  return {
    isOpen,
    openHUD,
    closeHUD,
    toggleHUD,
    masterVolume,
    isMuted,
    tracks,
    toggleMasterMute,
    setMasterVolume,
    setTrackVolume,
    toggleTrackPlay,
  };
}
