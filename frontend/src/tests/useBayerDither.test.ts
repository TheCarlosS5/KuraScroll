import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useBayerDither,
  localCalculateBayerDither,
} from '../reader/useBayerDither';

describe('useBayerDither Hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default tn_6bit_default preset and closed HUD', () => {
    const { result } = renderHook(() => useBayerDither('test-series-bayer'));

    expect(result.current.isHUDOpen).toBe(false);
    expect(result.current.presetName).toBe('tn_6bit_default');
    expect(result.current.matrixSize).toBe(8);
    expect(result.current.targetBits).toBe(6);
    expect(result.current.ditherStrength).toBe(0.85);
    expect(result.current.edgeProtection).toBe(0.25);
    expect(result.current.isEnabled).toBe(true);
    expect(result.current.currentResult.packedRgb).toBeDefined();
  });

  it('toggles HUD on keyboard key B / b', () => {
    const { result } = renderHook(() => useBayerDither('test-series-bayer'));

    expect(result.current.isHUDOpen).toBe(false);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b' }));
    });
    expect(result.current.isHUDOpen).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'B' }));
    });
    expect(result.current.isHUDOpen).toBe(false);
  });

  it('switches preset profiles and updates parameters', () => {
    const { result } = renderHook(() => useBayerDither('test-series-bayer'));

    act(() => {
      result.current.selectPreset('smooth_gradient');
    });
    expect(result.current.presetName).toBe('smooth_gradient');
    expect(result.current.ditherStrength).toBe(1.0);
    expect(result.current.edgeProtection).toBe(0.15);

    act(() => {
      result.current.selectPreset('text_protected');
    });
    expect(result.current.presetName).toBe('text_protected');
    expect(result.current.matrixSize).toBe(4);
    expect(result.current.ditherStrength).toBe(0.0);
  });

  it('calculates dithered output on pixel coordinate changes', () => {
    const { result } = renderHook(() => useBayerDither('test-series-bayer'));

    act(() => {
      result.current.setSample({ x: 2, y: 3, r: 100, g: 150, b: 200 });
    });

    expect(result.current.currentResult.outR).toBeGreaterThanOrEqual(0);
    expect(result.current.currentResult.outR).toBeLessThanOrEqual(255);
    expect(result.current.currentResult.threshold).toBeGreaterThan(0);
  });
});
