import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePageAcoustics } from '../reader/usePageAcoustics';

describe('Sprint 82 - usePageAcoustics Hook Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default options', () => {
    const { result } = renderHook(() =>
      usePageAcoustics({ enableKeyboard: false })
    );

    expect(result.current.isOpen).toBe(false);
    expect(result.current.isEnabled).toBe(true);
    expect(result.current.paperSubstrate).toBe('tankobon');
    expect(result.current.volume).toBe(0.65);
    expect(result.current.stereoPanningEnabled).toBe(true);
    expect(result.current.hapticPulseEnabled).toBe(true);
    expect(result.current.hapticIntensity).toBe(0.5);
  });

  it('controls HUD visibility correctly', () => {
    const { result } = renderHook(() =>
      usePageAcoustics({ enableKeyboard: false })
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

  it('updates substrate, volume, and haptic intensity with proper clamping', () => {
    const { result } = renderHook(() =>
      usePageAcoustics({ enableKeyboard: false })
    );

    act(() => {
      result.current.setPaperSubstrate('newsprint');
    });
    expect(result.current.paperSubstrate).toBe('newsprint');

    act(() => {
      result.current.setVolume(1.8); // Clamped to 1.0
    });
    expect(result.current.volume).toBe(1.0);

    act(() => {
      result.current.setVolume(-0.5); // Clamped to 0.0
    });
    expect(result.current.volume).toBe(0.0);

    act(() => {
      result.current.setHapticIntensity(1.5); // Clamped to 1.0
    });
    expect(result.current.hapticIntensity).toBe(1.0);
  });

  it('toggles stereo panning and haptic pulse switches', () => {
    const { result } = renderHook(() =>
      usePageAcoustics({ enableKeyboard: false })
    );

    act(() => {
      result.current.toggleStereoPanning();
    });
    expect(result.current.stereoPanningEnabled).toBe(false);

    act(() => {
      result.current.toggleHapticPulse();
    });
    expect(result.current.hapticPulseEnabled).toBe(false);

    act(() => {
      result.current.toggleEnabled();
    });
    expect(result.current.isEnabled).toBe(false);
  });

  it('handles playFlipAcoustic safely without error when AudioContext is mocked/missing', () => {
    const { result } = renderHook(() =>
      usePageAcoustics({ enableKeyboard: false })
    );

    expect(() => {
      act(() => {
        result.current.playFlipAcoustic('next', 'rtl');
      });
    }).not.toThrow();
  });
});
