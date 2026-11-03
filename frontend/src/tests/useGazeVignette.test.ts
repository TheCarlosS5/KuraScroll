import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useGazeVignette,
  localCalculateGazeVignette,
} from '../reader/useGazeVignette';

describe('useGazeVignette Hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default relaxed_reading_calm preset and closed HUD', () => {
    const { result } = renderHook(() => useGazeVignette('test-series-gaze'));

    expect(result.current.isHUDOpen).toBe(false);
    expect(result.current.presetName).toBe('relaxed_reading_calm');
    expect(result.current.omega).toBe(8.0);
    expect(result.current.deadZonePx).toBe(1.5);
    expect(result.current.snapThresholdPx).toBe(120.0);
    expect(result.current.vignetteMax).toBe(0.12);
    expect(result.current.radiusX).toBe(0.55);
    expect(result.current.radiusY).toBe(0.65);
    expect(result.current.q0).toBe(0.70);
    expect(result.current.q1).toBe(1.20);
    expect(result.current.isEnabled).toBe(true);
    expect(result.current.currentResult.stabilizedX).toBeDefined();
  });

  it('toggles HUD on keyboard key V', () => {
    const { result } = renderHook(() => useGazeVignette('test-series-gaze'));

    expect(result.current.isHUDOpen).toBe(false);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'v' }));
    });
    expect(result.current.isHUDOpen).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'V' }));
    });
    expect(result.current.isHUDOpen).toBe(false);
  });

  it('switches preset profiles and updates gaze & vignette parameters', () => {
    const { result } = renderHook(() => useGazeVignette('test-series-gaze'));

    act(() => {
      result.current.applyPreset('deep_focus_tunnel');
    });
    expect(result.current.presetName).toBe('deep_focus_tunnel');
    expect(result.current.omega).toBe(16.0);
    expect(result.current.vignetteMax).toBe(0.28);
    expect(result.current.radiusX).toBe(0.40);

    act(() => {
      result.current.applyPreset('shonen_action_burst');
    });
    expect(result.current.presetName).toBe('shonen_action_burst');
    expect(result.current.omega).toBe(24.0);
    expect(result.current.snapThresholdPx).toBe(100.0);
  });

  it('computes stabilized coordinates and vignette accurately', () => {
    const res = localCalculateGazeVignette(
      100,
      100,
      120,
      120,
      0,
      0,
      0.016,
      8.0,
      1.5,
      120.0,
      0.12,
      0.55,
      0.65,
      0.70,
      1.20,
      true
    );

    expect(res.stabilizedX).toBeGreaterThanOrEqual(100);
    expect(res.stabilizedX).toBeLessThanOrEqual(120);
    expect(res.isSnapping).toBe(false);
    expect(res.vignetteOpacity).toBeGreaterThanOrEqual(0);
    expect(res.vignetteOpacity).toBeLessThanOrEqual(0.12);
  });

  it('triggers editorial snap when saccade distance exceeds threshold', () => {
    const res = localCalculateGazeVignette(
      100,
      100,
      400,
      500,
      0,
      0,
      0.016,
      8.0,
      1.5,
      120.0,
      0.12,
      0.55,
      0.65,
      0.70,
      1.20,
      true
    );

    expect(res.isSnapping).toBe(true);
    expect(res.stabilizedX).toBe(400);
    expect(res.stabilizedY).toBe(500);
    expect(res.velocityX).toBe(0);
    expect(res.velocityY).toBe(0);
  });
});
