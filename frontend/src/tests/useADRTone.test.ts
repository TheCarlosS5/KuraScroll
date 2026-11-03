import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useADRTone,
  localCalculateADRTone,
} from '../reader/useADRTone';

describe('useADRTone Hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default berserk_night_recovery preset and closed HUD', () => {
    const { result } = renderHook(() => useADRTone('test-series-adr'));

    expect(result.current.isHUDOpen).toBe(false);
    expect(result.current.presetName).toBe('berserk_night_recovery');
    expect(result.current.shadowLift).toBe(0.55);
    expect(result.current.gamma).toBe(1.25);
    expect(result.current.shoulderClamp).toBe(0.95);
    expect(result.current.whitePoint).toBe(1.00);
    expect(result.current.isEnabled).toBe(true);
    expect(result.current.currentResult.outLuminance).toBeGreaterThan(0);
  });

  it('toggles HUD on keyboard key R / r', () => {
    const { result } = renderHook(() => useADRTone('test-series-adr'));

    expect(result.current.isHUDOpen).toBe(false);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'r' }));
    });
    expect(result.current.isHUDOpen).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'R' }));
    });
    expect(result.current.isHUDOpen).toBe(false);
  });

  it('switches preset profiles and updates parameters', () => {
    const { result } = renderHook(() => useADRTone('test-series-adr'));

    act(() => {
      result.current.selectPreset('shonen_deep_black');
    });
    expect(result.current.presetName).toBe('shonen_deep_black');
    expect(result.current.shadowLift).toBe(0.20);
    expect(result.current.gamma).toBe(1.05);

    act(() => {
      result.current.selectPreset('raw_linear');
    });
    expect(result.current.presetName).toBe('raw_linear');
    expect(result.current.shadowLift).toBe(0.00);
    expect(result.current.gamma).toBe(1.00);
  });

  it('calculates shadow lift without lifting pure black at 0', () => {
    const black = localCalculateADRTone(0, 0.55, 1.25, 0.95, 1.00, true);
    expect(black.outLuminance).toBe(0);

    const shadow = localCalculateADRTone(25, 0.55, 1.25, 0.95, 1.00, true);
    expect(shadow.outLuminance).toBeGreaterThan(25);
  });
});
