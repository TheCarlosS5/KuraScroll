import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useSpatialAudio,
  localCalculateSpatialAudio,
} from '../reader/useSpatialAudio';

describe('useSpatialAudio Hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default dialogue_near preset and closed HUD', () => {
    const { result } = renderHook(() => useSpatialAudio('test-series-spatial'));

    expect(result.current.isHUDOpen).toBe(false);
    expect(result.current.presetName).toBe('dialogue_near');
    expect(result.current.referenceDistancePx).toBe(120.0);
    expect(result.current.rolloffFactor).toBe(1.0);
    expect(result.current.minGain).toBe(0.025);
    expect(result.current.cutoffOpenHz).toBe(18000.0);
    expect(result.current.cutoffClosedHz).toBe(2500.0);
    expect(result.current.isEnabled).toBe(true);
    expect(result.current.currentResult.distancePx).toBeGreaterThan(0);
  });

  it('toggles HUD on keyboard key O / o', () => {
    const { result } = renderHook(() => useSpatialAudio('test-series-spatial'));

    expect(result.current.isHUDOpen).toBe(false);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'o' }));
    });
    expect(result.current.isHUDOpen).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'O' }));
    });
    expect(result.current.isHUDOpen).toBe(false);
  });

  it('switches preset profiles and updates acoustic parameters', () => {
    const { result } = renderHook(() => useSpatialAudio('test-series-spatial'));

    act(() => {
      result.current.selectPreset('dialogue_occluded');
    });
    expect(result.current.presetName).toBe('dialogue_occluded');
    expect(result.current.cutoffClosedHz).toBe(1200.0);

    act(() => {
      result.current.selectPreset('action_impact');
    });
    expect(result.current.presetName).toBe('action_impact');
    expect(result.current.referenceDistancePx).toBe(180.0);
    expect(result.current.maxDistancePx).toBe(1600.0);
    expect(result.current.cutoffClosedHz).toBe(900.0);
  });

  it('calculates spatial audio with occlusion and distance attenuation accurately', () => {
    const res = localCalculateSpatialAudio(400, 200, 200, 200, 0.5, 120, 1.0, 0.025, 1400, 480, 18000, 2500, true);
    expect(res.distancePx).toBe(200);
    expect(res.attenuation).toBeLessThan(1.0);
    expect(res.cutoffHz).toBeGreaterThan(2500);
    expect(res.cutoffHz).toBeLessThan(18000);
    expect(res.gainRight).toBeGreaterThan(res.gainLeft); // Source is to the right
  });
});
