import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useBoustrophedonCamera,
  planCameraTrajectory,
  evaluateCameraTrajectory,
} from '../reader/useBoustrophedonCamera';

describe('useBoustrophedonCamera Hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default manga_rtl_zigzag flow and closed HUD', () => {
    const { result } = renderHook(() => useBoustrophedonCamera('test-series'));

    expect(result.current.isHUDOpen).toBe(false);
    expect(result.current.readingFlow).toBe('manga_rtl_zigzag');
    expect(result.current.transitionEasing).toBe('cubic_bezier_cinematic');
    expect(result.current.climaxZoomMultiplier).toBe(1.25);
    expect(result.current.panLeadInPct).toBe(15);
    expect(result.current.isEnabled).toBe(true);
    expect(result.current.currentCameraState.cssTransform).toContain('translate3d');
  });

  it('toggles HUD on keyboard key C / c', () => {
    const { result } = renderHook(() => useBoustrophedonCamera('test-series'));

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

  it('switches reading sequence flows and updates defaults', () => {
    const { result } = renderHook(() => useBoustrophedonCamera('test-series'));

    act(() => {
      result.current.selectFlow('webtoon_vertical');
    });
    expect(result.current.readingFlow).toBe('webtoon_vertical');
    expect(result.current.transitionEasing).toBe('ease_in_out');
    expect(result.current.climaxZoomMultiplier).toBe(1.2);
    expect(result.current.panLeadInPct).toBe(20);

    act(() => {
      result.current.selectFlow('cinematic_freeflow');
    });
    expect(result.current.readingFlow).toBe('cinematic_freeflow');
    expect(result.current.transitionEasing).toBe('dramatic_punch');
    expect(result.current.climaxZoomMultiplier).toBe(1.35);
  });

  it('evaluates camera trajectory accurately with Horner rule without exceptions', () => {
    const plan = planCameraTrajectory(
      { x: 100, y: 100, width: 200, height: 200 },
      { x: 500, y: 500, width: 300, height: 300, isClimax: true },
      { readingFlow: 'manga_rtl_zigzag', climaxZoomMultiplier: 1.4 }
    );

    const state0 = evaluateCameraTrajectory(plan, 0);
    expect(state0.x).toBeCloseTo(200, 1);
    expect(state0.y).toBeCloseTo(200, 1);
    expect(state0.zoom).toBeCloseTo(1.0, 2);

    const state1 = evaluateCameraTrajectory(plan, 1);
    expect(state1.x).toBeCloseTo(650, 1);
    expect(state1.y).toBeCloseTo(650, 1);
    expect(state1.zoom).toBeCloseTo(1.4, 2);
  });
});
