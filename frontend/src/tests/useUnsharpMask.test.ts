import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useUnsharpMask,
  localCalculateUnsharpMask,
} from '../reader/useUnsharpMask';

describe('useUnsharpMask Hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default webtoon_ribbon_crisp preset and closed HUD', () => {
    const { result } = renderHook(() => useUnsharpMask('test-series-unsharp'));

    expect(result.current.isHUDOpen).toBe(false);
    expect(result.current.presetName).toBe('webtoon_ribbon_crisp');
    expect(result.current.sharpness).toBe(0.85);
    expect(result.current.edgeThreshold).toBe(12.0);
    expect(result.current.haloClamp).toBe(0.05);
    expect(result.current.maxWeight).toBe(0.35);
    expect(result.current.isEnabled).toBe(true);
    expect(result.current.currentResult.outValue).toBeGreaterThanOrEqual(0);
  });

  it('toggles HUD on keyboard key U / u', () => {
    const { result } = renderHook(() => useUnsharpMask('test-series-unsharp'));

    expect(result.current.isHUDOpen).toBe(false);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'u' }));
    });
    expect(result.current.isHUDOpen).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'U' }));
    });
    expect(result.current.isHUDOpen).toBe(false);
  });

  it('switches preset profiles and updates parameters', () => {
    const { result } = renderHook(() => useUnsharpMask('test-series-unsharp'));

    act(() => {
      result.current.selectPreset('tankobon_ink_accent');
    });
    expect(result.current.presetName).toBe('tankobon_ink_accent');
    expect(result.current.sharpness).toBe(0.65);
    expect(result.current.edgeThreshold).toBe(18.0);

    act(() => {
      result.current.selectPreset('furigana_edge_guard');
    });
    expect(result.current.presetName).toBe('furigana_edge_guard');
    expect(result.current.sharpness).toBe(1.00);
    expect(result.current.haloClamp).toBe(0.02);
  });

  it('calculates unsharp masking and suppresses halos accurately', () => {
    const res = localCalculateUnsharpMask(30, 220, 220, 30, 30, 0.85, 12.0, 0.05, 0.35, true);
    expect(res.contrast).toBe(190);
    expect(res.weight).toBeGreaterThan(0);
    expect(res.outValue).toBeGreaterThanOrEqual(0);
    expect(res.outValue).toBeLessThanOrEqual(255);
  });
});
