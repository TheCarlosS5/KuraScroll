import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAcousticReverb, localCalculateAcousticReverb } from '../reader/useAcousticReverb';

describe('useAcousticReverb Hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default confined_room preset and hidden HUD', () => {
    const { result } = renderHook(() => useAcousticReverb('test-series'));

    expect(result.current.isVisible).toBe(false);
    expect(result.current.profile.sceneEnvironment).toBe('confined_room');
    expect(result.current.profile.roomSizeM3).toBe(85.0);
    expect(result.current.profile.isEnabled).toBe(true);
    expect(result.current.result.isStable).toBe(true);
    expect(result.current.result.t60DecayS).toBe(1.20);
  });

  it('toggles visibility on key Y', () => {
    const { result } = renderHook(() => useAcousticReverb('test-series'));

    expect(result.current.isVisible).toBe(false);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'y' }));
    });
    expect(result.current.isVisible).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Y' }));
    });
    expect(result.current.isVisible).toBe(false);
  });

  it('switches presets correctly', () => {
    const { result } = renderHook(() => useAcousticReverb('test-series'));

    act(() => {
      result.current.setPreset('cave_echo');
    });
    expect(result.current.profile.sceneEnvironment).toBe('cave_echo');
    expect(result.current.profile.roomSizeM3).toBe(450.0);
    expect(result.current.profile.t60DecayS).toBe(2.80);

    act(() => {
      result.current.setPreset('outdoor_open');
    });
    expect(result.current.profile.sceneEnvironment).toBe('outdoor_open');
    expect(result.current.profile.roomSizeM3).toBe(1200.0);
    expect(result.current.profile.t60DecayS).toBe(0.25);
  });

  it('updates profile parameters', () => {
    const { result } = renderHook(() => useAcousticReverb('test-series'));

    act(() => {
      result.current.updateProfile({ isEnabled: false, wetDryMix: 0.15 });
    });
    expect(result.current.profile.isEnabled).toBe(false);
    expect(result.current.profile.wetDryMix).toBe(0.15);
    expect(result.current.result.feedbackGain).toBe(0.0);
    expect(result.current.result.dryGain).toBe(1.0);
  });

  it('localCalculateAcousticReverb calculates Sabine decay correctly', () => {
    const res = localCalculateAcousticReverb(100, 0.3, 1.5, 3000, 0.3, [20, 35, 50, 70], 'custom', true);
    expect(res.sceneEnvironment).toBe('custom');
    expect(res.isStable).toBe(true);
    expect(res.feedbackGain).toBeLessThanOrEqual(0.95);
    expect(res.earlyReflectionTapsMs.length).toBe(4);
  });
});
