import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useLensDistortion,
  localCalculateLensDistortion,
} from '../reader/useLensDistortion';

describe('useLensDistortion Hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default tankobon_flatbed_scanner preset and closed HUD', () => {
    const { result } = renderHook(() => useLensDistortion('test-series-ld'));

    expect(result.current.isHUDOpen).toBe(false);
    expect(result.current.presetName).toBe('tankobon_flatbed_scanner');
    expect(result.current.k1).toBe(-0.015);
    expect(result.current.k2).toBe(0.002);
    expect(result.current.redShift).toBe(0.004);
    expect(result.current.blueShift).toBe(-0.004);
    expect(result.current.scale).toBe(1.00);
    expect(result.current.isEnabled).toBe(true);
    expect(result.current.currentResult.correctedX).toBeDefined();
  });

  it('toggles HUD on keyboard key C / c', () => {
    const { result } = renderHook(() => useLensDistortion('test-series-ld'));

    expect(result.current.isHUDOpen).toBe(false);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'c' }));
    });
    expect(result.current.isHUDOpen).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'C' }));
    });
    expect(result.current.isHUDOpen).toBe(false);
  });

  it('switches preset profiles and updates optical parameters', () => {
    const { result } = renderHook(() => useLensDistortion('test-series-ld'));

    act(() => {
      result.current.selectPreset('aged_lens_barrel');
    });
    expect(result.current.presetName).toBe('aged_lens_barrel');
    expect(result.current.k1).toBe(-0.035);
    expect(result.current.scale).toBe(1.02);

    act(() => {
      result.current.selectPreset('pincushion_edge_fix');
    });
    expect(result.current.presetName).toBe('pincushion_edge_fix');
    expect(result.current.k1).toBe(0.025);
    expect(result.current.scale).toBe(0.98);
  });

  it('evaluates Brown-Conrady radial distortion without square roots', () => {
    const res = localCalculateLensDistortion(0.50, 0.50, -0.015, 0.002, 0.004, -0.004, 0.50, 0.50, 1.00, true);
    expect(res.distortionFactor).toBe(1.0);
    expect(res.correctedX).toBe(0.50);
  });
});
