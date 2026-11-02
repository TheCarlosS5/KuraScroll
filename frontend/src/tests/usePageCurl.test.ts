/**
 * KuraScroll Sprint 93: usePageCurl Hook Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePageCurl } from '../reader/usePageCurl';

describe('usePageCurl Hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default tankobon_stiff preset and proper bounds', () => {
    const { result } = renderHook(() => usePageCurl());

    expect(result.current.isEnabled).toBe(true);
    expect(result.current.isHUDVisible).toBe(false);
    expect(result.current.preset).toBe('tankobon_stiff');
    expect(result.current.paperStiffness).toBe(0.85);
    expect(result.current.maxCurlAngleDeg).toBe(45.0);
    expect(result.current.shadowDepth).toBe(0.40);
    expect(result.current.dragProgress).toBe(0.0);
    expect(result.current.transformMatrixCss).toBe('none');
  });

  it('toggles HUD visibility', () => {
    const { result } = renderHook(() => usePageCurl());

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
    const { result } = renderHook(() => usePageCurl());

    act(() => {
      result.current.resetToPreset('doujin_silk');
    });

    expect(result.current.preset).toBe('doujin_silk');
    expect(result.current.paperStiffness).toBe(0.60);
    expect(result.current.maxCurlAngleDeg).toBe(75.0);
    expect(result.current.shadowDepth).toBe(0.55);
  });

  it('calculates 2.5D kinematics when simulating turn progress', () => {
    const { result } = renderHook(() => usePageCurl());

    act(() => {
      result.current.simulateTurn(0.5, 60);
    });

    expect(result.current.dragProgress).toBe(0.5);
    expect(result.current.effectiveAngleDeg).toBeLessThan(0); // RTL negative angle
    expect(result.current.transformMatrixCss).toContain('perspective(1000px)');
    expect(result.current.transformMatrixCss).toContain('rotateY(');
    expect(result.current.spineShadowCss).toContain('linear-gradient(to left');
    expect(result.current.cornerPeelPercent).toBeGreaterThan(0);
    expect(result.current.isCompleted).toBe(false);
  });

  it('marks turn as completed when progress >= 0.95', () => {
    const { result } = renderHook(() => usePageCurl());

    act(() => {
      result.current.simulateTurn(0.96);
    });

    expect(result.current.isCompleted).toBe(true);
  });

  it('returns "none" transform strings when disabled', () => {
    const { result } = renderHook(() => usePageCurl());

    act(() => {
      result.current.simulateTurn(0.5);
      result.current.setIsEnabled(false);
    });

    expect(result.current.transformMatrixCss).toBe('none');
    expect(result.current.spineShadowCss).toBe('none');
  });

  it('toggles HUD on "k" keydown event', () => {
    const { result } = renderHook(() => usePageCurl());

    expect(result.current.isHUDVisible).toBe(false);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k' }));
    });
    expect(result.current.isHUDVisible).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'K' }));
    });
    expect(result.current.isHUDVisible).toBe(false);
  });
});
