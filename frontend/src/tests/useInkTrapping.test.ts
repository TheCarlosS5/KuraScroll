import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useInkTrapping,
  localCalculateInkTrapping,
} from '../reader/useInkTrapping';

describe('useInkTrapping Hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default vintage_rotary_offset_80s preset and closed HUD', () => {
    const { result } = renderHook(() => useInkTrapping('test-series-trapping'));

    expect(result.current.isHUDOpen).toBe(false);
    expect(result.current.presetName).toBe('vintage_rotary_offset_80s');
    expect(result.current.shiftCx).toBe(0.60);
    expect(result.current.shiftCy).toBe(-0.40);
    expect(result.current.shiftMx).toBe(-0.30);
    expect(result.current.shiftMy).toBe(0.50);
    expect(result.current.trapWidth).toBe(0.35);
    expect(result.current.trapMode).toBe('auto');
    expect(result.current.isEnabled).toBe(true);
    expect(result.current.currentResult.outR).toBeDefined();
  });

  it('toggles HUD on keyboard key Shift + T', () => {
    const { result } = renderHook(() => useInkTrapping('test-series-trapping'));

    expect(result.current.isHUDOpen).toBe(false);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'T', shiftKey: true }));
    });
    expect(result.current.isHUDOpen).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 't', shiftKey: true }));
    });
    expect(result.current.isHUDOpen).toBe(false);
  });

  it('switches preset profiles and updates trapping parameters', () => {
    const { result } = renderHook(() => useInkTrapping('test-series-trapping'));

    act(() => {
      result.current.applyPreset('shonen_color_centerfold');
    });
    expect(result.current.presetName).toBe('shonen_color_centerfold');
    expect(result.current.shiftCx).toBe(0.30);
    expect(result.current.trapMode).toBe('spread');

    act(() => {
      result.current.applyPreset('modern_cmyk_tight');
    });
    expect(result.current.presetName).toBe('modern_cmyk_tight');
    expect(result.current.shiftCx).toBe(0.05);
    expect(result.current.trapWidth).toBe(0.10);
  });

  it('computes edge trapping dilation and accurate color reconstruction', () => {
    const res = localCalculateInkTrapping(
      190,
      70,
      40,
      0.7,
      0.4,
      0.60,
      -0.40,
      -0.30,
      0.50,
      0.20,
      0.40,
      0.0,
      0.0,
      0.35,
      'spread',
      0.15,
      true
    );

    expect(res.trapIntensity).toBeGreaterThan(0);
    expect(res.outR).toBeGreaterThan(0);
    expect(res.outG).toBeGreaterThan(0);
  });
});
