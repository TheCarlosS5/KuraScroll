/**
 * KuraScroll Sprint 100: useVectorQuantizer Hook Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVectorQuantizer } from '../reader/useVectorQuantizer';

describe('useVectorQuantizer Hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default int8_quantized preset and proper parameters', () => {
    const { result } = renderHook(() => useVectorQuantizer());

    expect(result.current.isEnabled).toBe(true);
    expect(result.current.isHUDVisible).toBe(false);
    expect(result.current.mode).toBe('int8_quantized');
    expect(result.current.embeddingDimension).toBe(64);
    expect(result.current.similarityThreshold).toBe(0.75);
    expect(result.current.maxTopK).toBe(5);
    expect(result.current.isSpoilerShieldActive).toBe(true);
    expect(result.current.cosineSimilarity).toBeGreaterThan(0.9);
    expect(result.current.isMatch).toBe(true);
    expect(result.current.isSpoilerShielded).toBe(true); // reveal 25 > current 10
    expect(result.current.radarBarColor).toBe('#f59e0b'); // Amber
  });

  it('toggles HUD visibility', () => {
    const { result } = renderHook(() => useVectorQuantizer());

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
    const { result } = renderHook(() => useVectorQuantizer());

    act(() => {
      result.current.resetToPreset('exact_cosine');
    });

    expect(result.current.mode).toBe('exact_cosine');
    expect(result.current.embeddingDimension).toBe(128);
    expect(result.current.similarityThreshold).toBe(0.85);
    expect(result.current.maxTopK).toBe(10);
    expect(result.current.isSpoilerShieldActive).toBe(false);
  });

  it('unshields spoilers when user chapter catches up', () => {
    const { result } = renderHook(() => useVectorQuantizer());

    expect(result.current.isSpoilerShielded).toBe(true);

    act(() => {
      result.current.setUserCurrentChapter(30); // 30 >= 25
    });

    expect(result.current.isSpoilerShielded).toBe(false);
    expect(result.current.radarBarColor).toBe('#10b981'); // Emerald
  });

  it('toggles HUD on "q" and "Q" keydown events', () => {
    const { result } = renderHook(() => useVectorQuantizer());

    expect(result.current.isHUDVisible).toBe(false);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'q' }));
    });
    expect(result.current.isHUDVisible).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Q' }));
    });
    expect(result.current.isHUDVisible).toBe(false);
  });

  it('returns bypass values when disabled', () => {
    const { result } = renderHook(() => useVectorQuantizer());

    act(() => {
      result.current.setIsEnabled(false);
    });

    expect(result.current.cosineSimilarity).toBe(0.0);
    expect(result.current.isMatch).toBe(false);
    expect(result.current.isSpoilerShielded).toBe(false);
  });
});
