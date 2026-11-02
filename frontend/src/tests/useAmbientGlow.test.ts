/**
 * KuraScroll Sprint 92: useAmbientGlow Hook Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAmbientGlow } from '../reader/useAmbientGlow';

describe('useAmbientGlow Hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default cinematic_reactive preset and proper bounds', () => {
    const { result } = renderHook(() => useAmbientGlow());

    expect(result.current.isEnabled).toBe(true);
    expect(result.current.isHUDVisible).toBe(false);
    expect(result.current.mode).toBe('cinematic_reactive');
    expect(result.current.glowSpreadPx).toBe(64);
    expect(result.current.glowOpacity).toBe(0.45);
    expect(result.current.featherSmoothness).toBe(1.20);
    expect(result.current.topGradientCss).toContain('linear-gradient(to top');
    expect(result.current.bottomGradientCss).toContain('linear-gradient(to bottom');
    expect(result.current.combinedBoxGlowCss).toContain('inset 0 0');
  });

  it('toggles HUD visibility', () => {
    const { result } = renderHook(() => useAmbientGlow());

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
    const { result } = renderHook(() => useAmbientGlow());

    act(() => {
      result.current.resetToPreset('dark_monochrome_dim');
    });

    expect(result.current.mode).toBe('dark_monochrome_dim');
    expect(result.current.glowSpreadPx).toBe(48);
    expect(result.current.glowOpacity).toBe(0.25);
  });

  it('returns "none" gradient strings when disabled', () => {
    const { result } = renderHook(() => useAmbientGlow());

    act(() => {
      result.current.setIsEnabled(false);
    });

    expect(result.current.isEnabled).toBe(false);
    expect(result.current.topGradientCss).toBe('none');
    expect(result.current.bottomGradientCss).toBe('none');
    expect(result.current.combinedBoxGlowCss).toBe('none');
  });

  it('updates parameters and recalculates gradients', () => {
    const { result } = renderHook(() => useAmbientGlow());

    act(() => {
      result.current.setGlowSpreadPx(100);
      result.current.setGlowOpacity(0.75);
      result.current.setFeatherSmoothness(1.50);
    });

    expect(result.current.glowSpreadPx).toBe(100);
    expect(result.current.glowOpacity).toBe(0.75);
    expect(result.current.topGradientCss).toContain('150px');
  });
});
