/**
 * KuraScroll Sprint 104: useEyeRest Hook Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEyeRest } from '../reader/useEyeRest';

describe('useEyeRest Hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default subtle_vignette preset and proper parameters', () => {
    const { result } = renderHook(() => useEyeRest());

    expect(result.current.isHUDVisible).toBe(false);
    expect(result.current.profile.shutterMode).toBe('subtle_vignette');
    expect(result.current.profile.apertureRadiusPx).toBe(320);
    expect(result.current.profile.falloffPct).toBe(35);
    expect(result.current.profile.restIntervalMin).toBe(20);
    expect(result.current.profile.eyeCareWarmthK).toBe(3200);
    expect(result.current.profile.isEnabled).toBe(true);
    expect(result.current.result.radialGradientCss).toContain('radial-gradient');
  });

  it('toggles HUD visibility', () => {
    const { result } = renderHook(() => useEyeRest());

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

  it('responds to keyboard shortcut R to toggle HUD', () => {
    const { result } = renderHook(() => useEyeRest());

    expect(result.current.isHUDVisible).toBe(false);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'r' }));
    });
    expect(result.current.isHUDVisible).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'R' }));
    });
    expect(result.current.isHUDVisible).toBe(false);
  });

  it('switches presets correctly', () => {
    const { result } = renderHook(() => useEyeRest());

    act(() => {
      result.current.applyPreset('focus_spotlight');
    });
    expect(result.current.profile.shutterMode).toBe('focus_spotlight');
    expect(result.current.profile.apertureRadiusPx).toBe(240);
    expect(result.current.profile.falloffPct).toBe(25);

    act(() => {
      result.current.applyPreset('circadian_warmth');
    });
    expect(result.current.profile.shutterMode).toBe('circadian_warmth');
    expect(result.current.profile.eyeCareWarmthK).toBe(2400);
  });

  it('activates rest interval when elapsed reading time meets interval', () => {
    const { result } = renderHook(() =>
      useEyeRest({ elapsedReadingMin: 25 })
    );

    expect(result.current.result.isRestActive).toBe(true);
    expect(result.current.result.vignetteOpacity).toBeGreaterThan(0.35);
  });
});
