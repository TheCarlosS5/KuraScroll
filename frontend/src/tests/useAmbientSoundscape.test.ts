import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAmbientSoundscape } from '../reader/useAmbientSoundscape';

describe('Sprint 73 - useAmbientSoundscape Hook Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default options and tracks', () => {
    const { result } = renderHook(() =>
      useAmbientSoundscape({ enableKeyboard: false })
    );

    expect(result.current.isOpen).toBe(false);
    expect(result.current.masterVolume).toBe(70);
    expect(result.current.isMuted).toBe(false);
    expect(result.current.tracks.length).toBeGreaterThanOrEqual(6);
  });

  it('controls modal open/close/toggle correctly', () => {
    const { result } = renderHook(() =>
      useAmbientSoundscape({ enableKeyboard: false })
    );

    expect(result.current.isOpen).toBe(false);

    act(() => {
      result.current.openHUD();
    });
    expect(result.current.isOpen).toBe(true);

    act(() => {
      result.current.closeHUD();
    });
    expect(result.current.isOpen).toBe(false);

    act(() => {
      result.current.toggleHUD();
    });
    expect(result.current.isOpen).toBe(true);
  });

  it('toggles master mute state', () => {
    const { result } = renderHook(() =>
      useAmbientSoundscape({ enableKeyboard: false })
    );

    expect(result.current.isMuted).toBe(false);

    act(() => {
      result.current.toggleMasterMute();
    });
    expect(result.current.isMuted).toBe(true);

    act(() => {
      result.current.toggleMasterMute();
    });
    expect(result.current.isMuted).toBe(false);
  });

  it('sets master volume and unmutes automatically if increasing from muted', () => {
    const { result } = renderHook(() =>
      useAmbientSoundscape({ defaultIsMuted: true, enableKeyboard: false })
    );

    expect(result.current.isMuted).toBe(true);

    act(() => {
      result.current.setMasterVolume(80);
    });

    expect(result.current.masterVolume).toBe(80);
    expect(result.current.isMuted).toBe(false);
  });

  it('updates track volume and clamps boundaries', () => {
    const { result } = renderHook(() =>
      useAmbientSoundscape({ enableKeyboard: false })
    );

    act(() => {
      result.current.setTrackVolume('rain', 95);
    });

    const rainTrack = result.current.tracks.find((t) => t.id === 'rain');
    expect(rainTrack?.volume).toBe(95);

    // Clamp over 100
    act(() => {
      result.current.setTrackVolume('rain', 120);
    });
    expect(result.current.tracks.find((t) => t.id === 'rain')?.volume).toBe(100);
  });

  it('toggles track playback status', () => {
    const { result } = renderHook(() =>
      useAmbientSoundscape({ enableKeyboard: false })
    );

    expect(result.current.tracks.find((t) => t.id === 'campfire')?.isPlaying).toBe(false);

    act(() => {
      result.current.toggleTrackPlay('campfire');
    });

    expect(result.current.tracks.find((t) => t.id === 'campfire')?.isPlaying).toBe(true);

    act(() => {
      result.current.toggleTrackPlay('campfire');
    });

    expect(result.current.tracks.find((t) => t.id === 'campfire')?.isPlaying).toBe(false);
  });

  it('toggles HUD via keyboard shortcut "b" / "B"', () => {
    const { result } = renderHook(() =>
      useAmbientSoundscape({ enableKeyboard: true })
    );

    expect(result.current.isOpen).toBe(false);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b' }));
    });
    expect(result.current.isOpen).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'B' }));
    });
    expect(result.current.isOpen).toBe(false);
  });
});
