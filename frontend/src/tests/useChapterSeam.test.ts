/**
 * KuraScroll Sprint 105: useChapterSeam Hook Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChapterSeam } from '../reader/useChapterSeam';

describe('useChapterSeam Hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default smooth_continuous preset and proper parameters', () => {
    const { result } = renderHook(() => useChapterSeam());

    expect(result.current.isHUDVisible).toBe(false);
    expect(result.current.profile.decelerationMode).toBe('smooth_continuous');
    expect(result.current.profile.seamThresholdPx).toBe(160);
    expect(result.current.profile.dampingFactor).toBe(0.85);
    expect(result.current.profile.preBakePanels).toBe(4);
    expect(result.current.profile.isMagneticSnap).toBe(true);
    expect(result.current.profile.isEnabled).toBe(true);
  });

  it('toggles HUD visibility', () => {
    const { result } = renderHook(() => useChapterSeam());

    expect(result.current.isHUDVisible).toBe(false);
    act(() => {
      result.current.toggleHUD();
    });
    expect(result.current.isHUDVisible).toBe(true);
    act(() => {
      result.current.setIsHUDVisible(false);
    });
    expect(result.current.isHUDVisible).toBe(false);
  });

  it('responds to keyboard shortcut J to toggle HUD', () => {
    const { result } = renderHook(() => useChapterSeam());

    expect(result.current.isHUDVisible).toBe(false);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j' }));
    });
    expect(result.current.isHUDVisible).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'J' }));
    });
    expect(result.current.isHUDVisible).toBe(false);
  });

  it('switches presets correctly', () => {
    const { result } = renderHook(() => useChapterSeam());

    act(() => {
      result.current.applyPreset('tactile_snap');
    });
    expect(result.current.profile.decelerationMode).toBe('tactile_snap');
    expect(result.current.profile.seamThresholdPx).toBe(240);
    expect(result.current.profile.dampingFactor).toBe(0.92);
    expect(result.current.profile.preBakePanels).toBe(2);

    act(() => {
      result.current.applyPreset('rapid_glide');
    });
    expect(result.current.profile.decelerationMode).toBe('rapid_glide');
    expect(result.current.profile.seamThresholdPx).toBe(96);
    expect(result.current.profile.preBakePanels).toBe(6);
  });

  it('activates pre-bake and decelerates velocity near seam', () => {
    const { result } = renderHook(() =>
      useChapterSeam({
        currentVelocity: 800,
        distanceToSeamPx: 100, // inside 160px threshold
      })
    );

    expect(result.current.result.isPreBakeActive).toBe(true);
    expect(result.current.result.seamResistancePct).toBeGreaterThan(0);
    expect(result.current.result.adjustedVelocity).toBeLessThan(800);
  });
});
