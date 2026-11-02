/**
 * KuraScroll Sprint 95: useMotionStabilizer Hook Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMotionStabilizer } from '../reader/useMotionStabilizer';

describe('useMotionStabilizer Hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default smooth_spring preset and proper bounds', () => {
    const { result } = renderHook(() => useMotionStabilizer());

    expect(result.current.isEnabled).toBe(true);
    expect(result.current.isHUDVisible).toBe(false);
    expect(result.current.mode).toBe('smooth_spring');
    expect(result.current.dampingCoefficient).toBe(0.75);
    expect(result.current.velocityThresholdPx).toBe(350.0);
    expect(result.current.contrastBoostFactor).toBe(1.25);
    expect(result.current.isAntiGhostingEnabled).toBe(true);
    expect(result.current.contrastScale).toBe(1.00);
    expect(result.current.motionDeblurFilterCss).toBe('none');
  });

  it('toggles HUD visibility', () => {
    const { result } = renderHook(() => useMotionStabilizer());

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

  it('switches presets correctly', () => {
    const { result } = renderHook(() => useMotionStabilizer());

    act(() => {
      result.current.resetToPreset('high_inertia_damping');
    });

    expect(result.current.mode).toBe('high_inertia_damping');
    expect(result.current.dampingCoefficient).toBe(0.88);
    expect(result.current.velocityThresholdPx).toBe(250.0);
    expect(result.current.contrastBoostFactor).toBe(1.40);
  });

  it('calculates smoothed velocity and stabilized delta on gesture', () => {
    const { result } = renderHook(() => useMotionStabilizer());

    act(() => {
      result.current.simulateGesture(30, 400);
    });

    expect(result.current.currentVelocityPx).toBe(400);
    expect(result.current.smoothedVelocityPx).toBe(100); // 0 * 0.75 + 400 * 0.25
    expect(result.current.stabilizedDeltaY).toBeLessThan(30);
    expect(result.current.contrastScale).toBeGreaterThan(1.00);
    expect(result.current.motionDeblurFilterCss).toContain('contrast(');
  });

  it('toggles HUD on "m" keydown event', () => {
    const { result } = renderHook(() => useMotionStabilizer());

    expect(result.current.isHUDVisible).toBe(false);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'm' }));
    });
    expect(result.current.isHUDVisible).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'M' }));
    });
    expect(result.current.isHUDVisible).toBe(false);
  });
});
