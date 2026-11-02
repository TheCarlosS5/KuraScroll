/**
 * KuraScroll Sprint 89: useDynamicTone Hook Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDynamicTone } from '../reader/useDynamicTone';

describe('useDynamicTone Hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with cinema_night preset and proper defaults', () => {
    const { result } = renderHook(() => useDynamicTone());

    expect(result.current.isEnabled).toBe(true);
    expect(result.current.isHUDVisible).toBe(false);
    expect(result.current.mode).toBe('cinema_night');
    expect(result.current.gammaExponent).toBe(1.15);
    expect(result.current.blackPointLift).toBe(0.04);
    expect(result.current.whitePointCompress).toBe(0.92);
    expect(result.current.contrastPercent).toBeGreaterThan(50);
    expect(result.current.brightnessPercent).toBeGreaterThan(70);
    expect(result.current.cssFilterString).toContain('contrast(');
    expect(result.current.cssFilterString).toContain('brightness(');
  });

  it('toggles HUD visibility', () => {
    const { result } = renderHook(() => useDynamicTone());

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
    const { result } = renderHook(() => useDynamicTone());

    act(() => {
      result.current.resetToPreset('oled_pure_black');
    });

    expect(result.current.mode).toBe('oled_pure_black');
    expect(result.current.blackPointLift).toBe(0.00);
    expect(result.current.gammaExponent).toBe(1.00);
  });

  it('returns "none" css filter when disabled', () => {
    const { result } = renderHook(() => useDynamicTone());

    act(() => {
      result.current.setIsEnabled(false);
    });

    expect(result.current.isEnabled).toBe(false);
    expect(result.current.cssFilterString).toBe('none');
  });

  it('updates parameters and recalculates filter strings', () => {
    const { result } = renderHook(() => useDynamicTone());

    act(() => {
      result.current.setGammaExponent(1.50);
      result.current.setBlackPointLift(0.10);
      result.current.setWhitePointCompress(0.95);
    });

    expect(result.current.gammaExponent).toBe(1.50);
    expect(result.current.blackPointLift).toBe(0.10);
    expect(result.current.whitePointCompress).toBe(0.95);
    expect(result.current.cssFilterString).toContain('contrast(');
  });
});
