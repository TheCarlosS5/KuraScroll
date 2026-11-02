/**
 * KuraScroll Sprint 106: useBalloonFont Hook Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBalloonFont } from '../reader/useBalloonFont';

describe('useBalloonFont Hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default comfort_legibility preset and proper parameters', () => {
    const { result } = renderHook(() => useBalloonFont());

    expect(result.current.isHUDVisible).toBe(false);
    expect(result.current.profile.scalingMode).toBe('comfort_legibility');
    expect(result.current.profile.minFontSizePx).toBe(12);
    expect(result.current.profile.maxFontSizePx).toBe(28);
    expect(result.current.profile.targetDensityRatio).toBe(0.65);
    expect(result.current.profile.isFuriganaPreserved).toBe(true);
    expect(result.current.profile.isEnabled).toBe(true);
    expect(result.current.result.optimalFontSizePx).toBeGreaterThanOrEqual(12);
  });

  it('toggles HUD visibility', () => {
    const { result } = renderHook(() => useBalloonFont());

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

  it('responds to keyboard shortcut F to toggle HUD', () => {
    const { result } = renderHook(() => useBalloonFont());

    expect(result.current.isHUDVisible).toBe(false);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f' }));
    });
    expect(result.current.isHUDVisible).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F' }));
    });
    expect(result.current.isHUDVisible).toBe(false);
  });

  it('switches presets correctly', () => {
    const { result } = renderHook(() => useBalloonFont());

    act(() => {
      result.current.applyPreset('large_print');
    });
    expect(result.current.profile.scalingMode).toBe('large_print');
    expect(result.current.profile.minFontSizePx).toBe(16);
    expect(result.current.profile.maxFontSizePx).toBe(38);
    expect(result.current.profile.targetDensityRatio).toBe(0.50);

    act(() => {
      result.current.applyPreset('compact_dialogue');
    });
    expect(result.current.profile.scalingMode).toBe('compact_dialogue');
    expect(result.current.profile.minFontSizePx).toBe(10);
    expect(result.current.profile.isFuriganaPreserved).toBe(false);
  });

  it('adapts font size to bubble dimensions and text length', () => {
    const { result: largeBubble } = renderHook(() =>
      useBalloonFont({
        balloonWidth: 400,
        balloonHeight: 300,
        textLength: 20,
      })
    );

    const { result: smallBubble } = renderHook(() =>
      useBalloonFont({
        balloonWidth: 100,
        balloonHeight: 80,
        textLength: 80,
      })
    );

    expect(largeBubble.current.result.optimalFontSizePx).toBeGreaterThan(
      smallBubble.current.result.optimalFontSizePx
    );
  });
});
