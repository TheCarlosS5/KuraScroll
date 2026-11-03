import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useCelluloseRelief,
  evaluateClientCelluloseRelief,
} from '../reader/useCelluloseRelief';

describe('useCelluloseRelief Hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default tankobon_woodfree_matte preset and closed HUD', () => {
    const { result } = renderHook(() => useCelluloseRelief({ seriesId: 'test-series-cr' }));

    expect(result.current.isHudOpen).toBe(false);
    expect(result.current.profile.presetName).toBe('tankobon_woodfree_matte');
    expect(result.current.profile.grainScale).toBe(1.00);
    expect(result.current.profile.reliefDepth).toBe(0.25);
    expect(result.current.profile.fiberDensity).toBe(0.50);
    expect(result.current.profile.isEnabled).toBe(true);
  });

  it('toggles HUD on keyboard key Shift + F', () => {
    const { result } = renderHook(() => useCelluloseRelief({ seriesId: 'test-series-cr' }));

    expect(result.current.isHudOpen).toBe(false);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F', shiftKey: true }));
    });
    expect(result.current.isHudOpen).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', shiftKey: true }));
    });
    expect(result.current.isHudOpen).toBe(false);
  });

  it('switches preset profiles accurately', () => {
    const { result } = renderHook(() => useCelluloseRelief({ seriesId: 'test-series-cr' }));

    act(() => {
      result.current.applyPreset('shonen_pulp_unbleached');
    });
    expect(result.current.profile.presetName).toBe('shonen_pulp_unbleached');
    expect(result.current.profile.grainScale).toBe(1.40);
    expect(result.current.profile.reliefDepth).toBe(0.45);
    expect(result.current.profile.fiberDensity).toBe(0.75);

    act(() => {
      result.current.applyPreset('raw_fixed');
    });
    expect(result.current.profile.presetName).toBe('raw_fixed');
    expect(result.current.profile.isEnabled).toBe(false);
  });

  it('evaluates relief locally and respects black ink suppression', () => {
    // Pure black ink
    const inkRes = evaluateClientCelluloseRelief(50, 50, 1.0, 1.0, 0.3, 0.5, 0.78, true);
    expect(inkRes.effectiveRelief).toBe(0.0);
    expect(inkRes.isSuppressedByInk).toBe(true);

    // Virgin paper
    const paperRes = evaluateClientCelluloseRelief(50, 50, 0.0, 1.0, 0.3, 0.5, 0.78, true);
    expect(paperRes.effectiveRelief).toBeGreaterThan(0.0);
    expect(paperRes.diffuseLight).toBeGreaterThan(0.0);
    expect(paperRes.isSuppressedByInk).toBe(false);
  });
});
