import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useMotionDeblur,
  localCalculateMotionDeblur,
} from '../reader/useMotionDeblur';

describe('useMotionDeblur Hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default tn_slow_panel_compensation preset and closed HUD', () => {
    const { result } = renderHook(() => useMotionDeblur('test-series-deblur'));

    expect(result.current.isHUDOpen).toBe(false);
    expect(result.current.presetName).toBe('tn_slow_panel_compensation');
    expect(result.current.kod).toBe(1.35);
    expect(result.current.vHalf).toBe(650.0);
    expect(result.current.maxDelta).toBe(45.0);
    expect(result.current.gammaFall).toBe(1.30);
    expect(result.current.gammaRise).toBe(1.00);
    expect(result.current.isEnabled).toBe(true);
    expect(result.current.currentResult.outL).toBeDefined();
  });

  it('toggles HUD on keyboard key Shift + M', () => {
    const { result } = renderHook(() => useMotionDeblur('test-series-deblur'));

    expect(result.current.isHUDOpen).toBe(false);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'M', shiftKey: true }));
    });
    expect(result.current.isHUDOpen).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', shiftKey: true }));
    });
    expect(result.current.isHUDOpen).toBe(false);
  });

  it('switches preset profiles and updates overdrive parameters', () => {
    const { result } = renderHook(() => useMotionDeblur('test-series-deblur'));

    act(() => {
      result.current.applyPreset('webtoon_high_speed_flick');
    });
    expect(result.current.presetName).toBe('webtoon_high_speed_flick');
    expect(result.current.kod).toBe(1.80);
    expect(result.current.maxDelta).toBe(65.0);

    act(() => {
      result.current.applyPreset('subtle_lcd_response_boost');
    });
    expect(result.current.presetName).toBe('subtle_lcd_response_boost');
    expect(result.current.kod).toBe(0.80);
    expect(result.current.maxDelta).toBe(25.0);
  });

  it('computes positive overdrive on brightening and negative overdrive on darkening', () => {
    const brightRes = localCalculateMotionDeblur(
      210,
      130,
      1200,
      1.35,
      650.0,
      45.0,
      1.30,
      1.00,
      true
    );
    expect(brightRes.boost).toBeGreaterThan(0);
    expect(brightRes.outL).toBeGreaterThan(210);

    const darkRes = localCalculateMotionDeblur(
      100,
      190,
      1200,
      1.35,
      650.0,
      45.0,
      1.30,
      1.00,
      true
    );
    expect(darkRes.boost).toBeLessThan(0);
    expect(darkRes.outL).toBeLessThan(100);
  });
});
