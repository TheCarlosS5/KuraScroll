/**
 * KuraScroll Sprint 88: useInertialScroll Hook Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInertialScroll } from '../reader/useInertialScroll';

describe('useInertialScroll Hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default natural_paper preset and resting state', () => {
    const { result } = renderHook(() => useInertialScroll());

    expect(result.current.isEnabled).toBe(true);
    expect(result.current.isHUDVisible).toBe(false);
    expect(result.current.preset).toBe('natural_paper');
    expect(result.current.currentPos).toBe(0);
    expect(result.current.velocity).toBe(0);
    expect(result.current.isResting).toBe(true);
    expect(result.current.frictionCoefficient).toBe(0.90);
    expect(result.current.springTension).toBe(150.0);
  });

  it('toggles HUD visibility', () => {
    const { result } = renderHook(() => useInertialScroll());

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

  it('applies impulses and wakes physics simulation', () => {
    const { result } = renderHook(() => useInertialScroll());

    act(() => {
      result.current.applyImpulse(100);
    });

    expect(result.current.targetPos).toBe(100);
    expect(result.current.velocity).toBeGreaterThan(0);
    expect(result.current.isResting).toBe(false);
  });

  it('steps physics forward towards target position', () => {
    const { result } = renderHook(() => useInertialScroll());

    act(() => {
      result.current.applyImpulse(200);
    });

    act(() => {
      result.current.stepPhysics(16.6667);
    });

    expect(result.current.currentPos).toBeGreaterThan(0);
  });

  it('switches preset and updates friction parameters', () => {
    const { result } = renderHook(() => useInertialScroll());

    act(() => {
      result.current.setPreset('smooth_glider');
    });

    expect(result.current.preset).toBe('smooth_glider');
    expect(result.current.frictionCoefficient).toBe(0.94);
    expect(result.current.springTension).toBe(100.0);
  });
});
