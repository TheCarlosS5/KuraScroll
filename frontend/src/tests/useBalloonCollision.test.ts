/**
 * KuraScroll Sprint 102: useBalloonCollision Hook Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBalloonCollision } from '../reader/useBalloonCollision';

describe('useBalloonCollision Hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default minimal_euclidean preset and proper parameters', () => {
    const { result } = renderHook(() => useBalloonCollision());

    expect(result.current.isHUDVisible).toBe(false);
    expect(result.current.profile.avoidanceStrategy).toBe('minimal_euclidean');
    expect(result.current.profile.safetyMarginPx).toBe(12);
    expect(result.current.profile.maxDisplacementPx).toBe(120);
    expect(result.current.profile.preferVerticalShift).toBe(true);
    expect(result.current.profile.isEnabled).toBe(true);
    expect(result.current.result.hasCollision).toBe(true);
  });

  it('toggles HUD visibility', () => {
    const { result } = renderHook(() => useBalloonCollision());

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

  it('responds to keyboard shortcut O to toggle HUD', () => {
    const { result } = renderHook(() => useBalloonCollision());

    expect(result.current.isHUDVisible).toBe(false);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'o' }));
    });
    expect(result.current.isHUDVisible).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'O' }));
    });
    expect(result.current.isHUDVisible).toBe(false);
  });

  it('switches presets correctly', () => {
    const { result } = renderHook(() => useBalloonCollision());

    act(() => {
      result.current.applyPreset('reading_gravity_downward');
    });
    expect(result.current.profile.avoidanceStrategy).toBe('reading_gravity_downward');
    expect(result.current.profile.safetyMarginPx).toBe(16);
    expect(result.current.profile.maxDisplacementPx).toBe(180);

    act(() => {
      result.current.applyPreset('opposite_margin');
    });
    expect(result.current.profile.avoidanceStrategy).toBe('opposite_margin');
    expect(result.current.profile.safetyMarginPx).toBe(8);
  });

  it('calculates clear path without displacement when no balloons overlap', () => {
    const { result } = renderHook(() =>
      useBalloonCollision({
        overlayBox: { x: 50, y: 50, width: 100, height: 50 },
        balloonBoxes: [{ x: 500, y: 500, width: 150, height: 80 }],
      })
    );

    expect(result.current.result.hasCollision).toBe(false);
    expect(result.current.result.dx).toBe(0);
    expect(result.current.result.dy).toBe(0);
    expect(result.current.result.displacementMagnitude).toBe(0);
  });
});
