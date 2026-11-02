import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGlyphSharpener, localCalculateGlyphSharpener } from '../reader/useGlyphSharpener';

describe('useGlyphSharpener Hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default adaptive_kanji preset and hidden HUD', () => {
    const { result } = renderHook(() => useGlyphSharpener('test-series'));

    expect(result.current.isVisible).toBe(false);
    expect(result.current.profile.sharpenerMode).toBe('adaptive_kanji');
    expect(result.current.profile.contrastMultiplier).toBe(1.15);
    expect(result.current.profile.strokeProtectionPct).toBe(65);
    expect(result.current.profile.isEnabled).toBe(true);
    expect(result.current.sampleResult.effectiveContrast).toBeGreaterThan(1.0);
    expect(result.current.sampleResult.cssFilter).toContain('contrast(');
  });

  it('toggles visibility on key K', () => {
    const { result } = renderHook(() => useGlyphSharpener('test-series'));

    expect(result.current.isVisible).toBe(false);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k' }));
    });
    expect(result.current.isVisible).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'K' }));
    });
    expect(result.current.isVisible).toBe(false);
  });

  it('switches typographic presets correctly', () => {
    const { result } = renderHook(() => useGlyphSharpener('test-series'));

    act(() => {
      result.current.setPreset('high_contrast_furigana');
    });
    expect(result.current.profile.sharpenerMode).toBe('high_contrast_furigana');
    expect(result.current.profile.contrastMultiplier).toBe(1.25);

    act(() => {
      result.current.setPreset('dense_cjk_compaction');
    });
    expect(result.current.profile.sharpenerMode).toBe('dense_cjk_compaction');
    expect(result.current.profile.strokeProtectionPct).toBe(85);
  });

  it('updates profile parameters dynamically', () => {
    const { result } = renderHook(() => useGlyphSharpener('test-series'));

    act(() => {
      result.current.updateProfile({ isEnabled: false });
    });
    expect(result.current.profile.isEnabled).toBe(false);
    expect(result.current.sampleResult.cssFilter).toBe('none');
  });

  it('localCalculateGlyphSharpener computes contrast and handles dense kanji', () => {
    const normal = localCalculateGlyphSharpener(6, 1.0, 1.25, 1.05, 65, 'adaptive_kanji', true);
    const dense = localCalculateGlyphSharpener(22, 1.0, 1.25, 1.05, 65, 'adaptive_kanji', true);

    expect(dense.isDenseStrokeCompensated).toBe(true);
    expect(dense.effectiveContrast).toBeLessThan(normal.effectiveContrast);
  });
});
