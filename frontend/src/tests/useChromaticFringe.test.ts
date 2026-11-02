/**
 * KuraScroll Sprint 91: useChromaticFringe Hook Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChromaticFringe } from '../reader/useChromaticFringe';

describe('useChromaticFringe Hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default subpixel_rgb preset and proper bounds', () => {
    const { result } = renderHook(() => useChromaticFringe());

    expect(result.current.isEnabled).toBe(true);
    expect(result.current.isHUDVisible).toBe(false);
    expect(result.current.mode).toBe('subpixel_rgb');
    expect(result.current.fringeRadiusPx).toBe(0.75);
    expect(result.current.desaturationStrength).toBe(0.60);
    expect(result.current.sharpeningAmount).toBe(1.25);
    expect(result.current.cssFilterString).toContain('saturate(');
    expect(result.current.cssFilterString).toContain('contrast(');
  });

  it('toggles HUD visibility', () => {
    const { result } = renderHook(() => useChromaticFringe());

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
    const { result } = renderHook(() => useChromaticFringe());

    act(() => {
      result.current.resetToPreset('monochrome_ink');
    });

    expect(result.current.mode).toBe('monochrome_ink');
    expect(result.current.desaturationStrength).toBe(0.95);
    expect(result.current.fringeRadiusPx).toBe(1.20);
  });

  it('returns "none" filter string when disabled', () => {
    const { result } = renderHook(() => useChromaticFringe());

    act(() => {
      result.current.setIsEnabled(false);
    });

    expect(result.current.isEnabled).toBe(false);
    expect(result.current.cssFilterString).toBe('none');
    expect(result.current.svgMatrixString).toBe('none');
  });

  it('updates parameters and recalculates filters', () => {
    const { result } = renderHook(() => useChromaticFringe());

    act(() => {
      result.current.setFringeRadiusPx(1.50);
      result.current.setDesaturationStrength(0.80);
      result.current.setSharpeningAmount(2.00);
    });

    expect(result.current.fringeRadiusPx).toBe(1.50);
    expect(result.current.desaturationStrength).toBe(0.80);
    expect(result.current.sharpeningAmount).toBe(2.00);
    expect(result.current.effectiveContrastMultiplier).toBeGreaterThan(2.0);
  });
});
