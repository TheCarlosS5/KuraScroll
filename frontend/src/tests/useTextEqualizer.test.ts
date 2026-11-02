/**
 * KuraScroll Sprint 97: useTextEqualizer Hook Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTextEqualizer } from '../reader/useTextEqualizer';

describe('useTextEqualizer Hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default newsprint_vintage preset and proper parameters', () => {
    const { result } = renderHook(() => useTextEqualizer());

    expect(result.current.isEnabled).toBe(true);
    expect(result.current.isHUDVisible).toBe(false);
    expect(result.current.mode).toBe('newsprint_vintage');
    expect(result.current.blackLevelBoost).toBe(0.35);
    expect(result.current.whiteLevelCompression).toBe(0.20);
    expect(result.current.kanjiClarityFactor).toBe(1.30);
    expect(result.current.isFuriganaSharpenEnabled).toBe(true);
    expect(result.current.effectiveContrast).toBe(1.16);
    expect(result.current.effectiveBrightness).toBe(0.98);
    expect(result.current.edgeSharpenPx).toBe(0.18);
    expect(result.current.isHighDensityBoostActive).toBe(true);
  });

  it('toggles HUD visibility', () => {
    const { result } = renderHook(() => useTextEqualizer());

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
    const { result } = renderHook(() => useTextEqualizer());

    act(() => {
      result.current.resetToPreset('glossy_digital');
    });

    expect(result.current.mode).toBe('glossy_digital');
    expect(result.current.blackLevelBoost).toBe(0.15);
    expect(result.current.whiteLevelCompression).toBe(0.10);
    expect(result.current.kanjiClarityFactor).toBe(1.15);
    expect(result.current.isFuriganaSharpenEnabled).toBe(false);
    expect(result.current.edgeSharpenPx).toBe(0);
    expect(result.current.subpixelMatrixCss).toBe('none');
  });

  it('toggles furigana sharpen state and recomputes edge sharpen px', () => {
    const { result } = renderHook(() => useTextEqualizer());

    expect(result.current.isFuriganaSharpenEnabled).toBe(true);
    expect(result.current.edgeSharpenPx).toBe(0.18);

    act(() => {
      result.current.toggleFuriganaSharpen();
    });

    expect(result.current.isFuriganaSharpenEnabled).toBe(false);
    expect(result.current.edgeSharpenPx).toBe(0);
  });

  it('toggles HUD on "e" keydown event', () => {
    const { result } = renderHook(() => useTextEqualizer());

    expect(result.current.isHUDVisible).toBe(false);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e' }));
    });
    expect(result.current.isHUDVisible).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'E' }));
    });
    expect(result.current.isHUDVisible).toBe(false);
  });

  it('returns bypass filters when disabled', () => {
    const { result } = renderHook(() => useTextEqualizer());

    act(() => {
      result.current.setIsEnabled(false);
    });

    expect(result.current.effectiveContrast).toBe(1.00);
    expect(result.current.effectiveBrightness).toBe(1.00);
    expect(result.current.compositeFilterCss).toBe('none');
    expect(result.current.subpixelMatrixCss).toBe('none');
  });
});
