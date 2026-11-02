import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useHalftoneGrain,
  localCalculateHalftoneGrain,
} from '../reader/useHalftoneGrain';

describe('useHalftoneGrain Hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default shonen_jump_pulp preset and closed HUD', () => {
    const { result } = renderHook(() => useHalftoneGrain('test-series-grain'));

    expect(result.current.isHUDOpen).toBe(false);
    expect(result.current.grainMode).toBe('shonen_jump_pulp');
    expect(result.current.stippleDensity).toBe(0.18);
    expect(result.current.grainOpacity).toBe(0.065);
    expect(result.current.particleRadiusPx).toBe(0.9);
    expect(result.current.paperTintHex).toBe('#FAF3E0');
    expect(result.current.blendMode).toBe('multiply');
    expect(result.current.isEnabled).toBe(true);
    expect(result.current.currentResult.cssBackgroundRepeat).toBe('repeat');
  });

  it('toggles HUD on keyboard key G / g', () => {
    const { result } = renderHook(() => useHalftoneGrain('test-series-grain'));

    expect(result.current.isHUDOpen).toBe(false);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'g' }));
    });
    expect(result.current.isHUDOpen).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'G' }));
    });
    expect(result.current.isHUDOpen).toBe(false);
  });

  it('switches paper presets and updates parameters', () => {
    const { result } = renderHook(() => useHalftoneGrain('test-series-grain'));

    act(() => {
      result.current.selectPreset('archival_acid_free');
    });
    expect(result.current.grainMode).toBe('archival_acid_free');
    expect(result.current.stippleDensity).toBe(0.08);
    expect(result.current.grainOpacity).toBe(0.025);
    expect(result.current.paperTintHex).toBe('#FFFDF9');

    act(() => {
      result.current.selectPreset('tankobon_newsprint');
    });
    expect(result.current.grainMode).toBe('tankobon_newsprint');
    expect(result.current.stippleDensity).toBe(0.15);
  });

  it('evaluates localCalculateHalftoneGrain correctly with zero allocation', () => {
    const res = localCalculateHalftoneGrain(0.18, 0.065, 0.9, 1337, 'shonen_jump_pulp', '#FAF3E0', 'multiply', true);
    expect(res.stippleDensity).toBe(0.18);
    expect(res.grainOpacity).toBe(0.065);
    expect(res.cssBackgroundRepeat).toBe('repeat');
    expect(res.estimatedMemoryKiB).toBe(16);
  });
});
