import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useCmykSimulator,
  localCalculateCmykSimulation,
} from '../reader/useCmykSimulator';

describe('useCmykSimulator Hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default tankobon_four_color preset and closed HUD', () => {
    const { result } = renderHook(() => useCmykSimulator('test-series-cmyk'));

    expect(result.current.isHUDOpen).toBe(false);
    expect(result.current.presetName).toBe('tankobon_four_color');
    expect(result.current.tacLimit).toBe(2.80);
    expect(result.current.dotGain).toBe(0.10);
    expect(result.current.blackAbsorption).toBe(0.10);
    expect(result.current.gamutCompression).toBe(0.15);
    expect(result.current.isEnabled).toBe(true);
    expect(result.current.currentResult.totalAreaCoverage).toBeDefined();
  });

  it('toggles HUD on keyboard key Shift + C', () => {
    const { result } = renderHook(() => useCmykSimulator('test-series-cmyk'));

    expect(result.current.isHUDOpen).toBe(false);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'C', shiftKey: true }));
    });
    expect(result.current.isHUDOpen).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', shiftKey: true }));
    });
    expect(result.current.isHUDOpen).toBe(false);
  });

  it('switches preset profiles and updates CMYK parameters', () => {
    const { result } = renderHook(() => useCmykSimulator('test-series-cmyk'));

    act(() => {
      result.current.selectPreset('shonen_color_spread');
    });
    expect(result.current.presetName).toBe('shonen_color_spread');
    expect(result.current.tacLimit).toBe(3.00);
    expect(result.current.dotGain).toBe(0.12);

    act(() => {
      result.current.selectPreset('vintage_faded_pulp');
    });
    expect(result.current.presetName).toBe('vintage_faded_pulp');
    expect(result.current.tacLimit).toBe(2.40);
    expect(result.current.dotGain).toBe(0.20);
  });

  it('evaluates local CMYK simulation and handles pure black', () => {
    const resBlack = localCalculateCmykSimulation(0, 0, 0, 2.80, 0.10, 0.10, 0.15, true);
    expect(resBlack.black).toBe(1.0);
    expect(resBlack.cyan).toBe(0);
    expect(resBlack.outR).toBe(0);
    expect(resBlack.outG).toBe(0);
    expect(resBlack.outB).toBe(0);
  });
});
