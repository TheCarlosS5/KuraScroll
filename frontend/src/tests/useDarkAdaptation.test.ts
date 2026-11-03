import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useDarkAdaptation,
  localCalculateDarkAdaptation,
} from '../reader/useDarkAdaptation';

describe('useDarkAdaptation Hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default midnight_reader preset and closed HUD', () => {
    const { result } = renderHook(() => useDarkAdaptation('test-series-da'));

    expect(result.current.isHUDOpen).toBe(false);
    expect(result.current.presetName).toBe('midnight_reader');
    expect(result.current.comfortLuminance).toBe(0.22);
    expect(result.current.baseWhitePoint).toBe(0.88);
    expect(result.current.isEnabled).toBe(true);
    expect(result.current.currentResult.whitePoint).toBeLessThanOrEqual(1.0);
  });

  it('toggles HUD on keyboard key D / d', () => {
    const { result } = renderHook(() => useDarkAdaptation('test-series-da'));

    expect(result.current.isHUDOpen).toBe(false);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd' }));
    });
    expect(result.current.isHUDOpen).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'D' }));
    });
    expect(result.current.isHUDOpen).toBe(false);
  });

  it('switches preset profiles and updates parameters', () => {
    const { result } = renderHook(() => useDarkAdaptation('test-series-da'));

    act(() => {
      result.current.selectPreset('night_shonen');
    });
    expect(result.current.presetName).toBe('night_shonen');
    expect(result.current.contrastBase).toBe(1.15);
    expect(result.current.comfortLuminance).toBe(0.28);

    act(() => {
      result.current.selectPreset('paper_sepia');
    });
    expect(result.current.presetName).toBe('paper_sepia');
    expect(result.current.glareAttenuation).toBe(0.40);
  });

  it('simulates luminance step transitions smoothly', () => {
    const { result } = renderHook(() => useDarkAdaptation('test-series-da'));

    act(() => {
      result.current.simulateLuminanceStep(0.95);
    });

    expect(result.current.inputLuminance).toBe(0.95);
    expect(result.current.prevAdaptedLuminance).toBeGreaterThan(0.20);
    expect(result.current.currentResult.whitePoint).toBeLessThanOrEqual(1.0);

    // When adapted luminance is high (> glareThreshold 0.70), glareRatio activates
    act(() => {
      result.current.setPrevAdaptedLuminance(0.85);
    });
    expect(result.current.currentResult.glareRatio).toBeGreaterThan(0);
    expect(result.current.currentResult.whitePoint).toBeLessThan(0.88);
  });
});
