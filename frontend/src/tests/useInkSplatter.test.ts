import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useInkSplatter,
  evaluateClientInkSplatter,
} from '../reader/useInkSplatter';

describe('useInkSplatter Hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default shonen_impact_burst preset and closed HUD', () => {
    const { result } = renderHook(() => useInkSplatter({ seriesId: 'test-series-is' }));

    expect(result.current.isHudOpen).toBe(false);
    expect(result.current.profile.presetName).toBe('shonen_impact_burst');
    expect(result.current.profile.strokeVelocity).toBe(750.0);
    expect(result.current.profile.bleedRadiusPx).toBe(1.8);
    expect(result.current.profile.splatterDensity).toBe(0.70);
    expect(result.current.profile.isEnabled).toBe(true);
  });

  it('toggles HUD on keyboard key Shift + S', () => {
    const { result } = renderHook(() => useInkSplatter({ seriesId: 'test-series-is' }));

    expect(result.current.isHudOpen).toBe(false);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'S', shiftKey: true }));
    });
    expect(result.current.isHudOpen).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', shiftKey: true }));
    });
    expect(result.current.isHudOpen).toBe(false);
  });

  it('switches preset profiles accurately', () => {
    const { result } = renderHook(() => useInkSplatter({ seriesId: 'test-series-is' }));

    act(() => {
      result.current.applyPreset('vintage_gpen_newsprint');
    });
    expect(result.current.profile.presetName).toBe('vintage_gpen_newsprint');
    expect(result.current.profile.strokeVelocity).toBe(200.0);
    expect(result.current.profile.bleedRadiusPx).toBe(2.4);

    act(() => {
      result.current.applyPreset('raw_fixed');
    });
    expect(result.current.profile.presetName).toBe('raw_fixed');
    expect(result.current.profile.isEnabled).toBe(false);
  });

  it('evaluates splatter locally and respects zero-velocity static condition', () => {
    // Zero velocity
    const staticRes = evaluateClientInkSplatter(100, 100, 0, 0, 1.2, 0.5, 0.4, true);
    expect(staticRes.dropletCount).toBe(0);
    expect(staticRes.effectiveBleed).toBeGreaterThan(0);

    // High velocity
    const dynamicRes = evaluateClientInkSplatter(100, 100, 0.5, 600, 1.2, 0.5, 0.4, true);
    expect(dynamicRes.dropletCount).toBeGreaterThan(0);
    expect(dynamicRes.droplets.length).toBeGreaterThan(0);
  });
});
