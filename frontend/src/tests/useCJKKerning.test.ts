import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useCJKKerning,
  localCalculateCJKKerning,
} from '../reader/useCJKKerning';

describe('useCJKKerning Hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default manga_dense_kanji preset and closed HUD', () => {
    const { result } = renderHook(() => useCJKKerning('test-series-cjk'));

    expect(result.current.isHUDOpen).toBe(false);
    expect(result.current.presetName).toBe('manga_dense_kanji');
    expect(result.current.baseKerningEm).toBe(0.04);
    expect(result.current.trackingRatio).toBe(0.015);
    expect(result.current.minKerningEm).toBe(-0.02);
    expect(result.current.maxKerningEm).toBe(0.20);
    expect(result.current.isEnabled).toBe(true);
    expect(result.current.currentResult.cssLetterSpacing).toBeDefined();
  });

  it('toggles HUD on keyboard key K / k', () => {
    const { result } = renderHook(() => useCJKKerning('test-series-cjk'));

    expect(result.current.isHUDOpen).toBe(false);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k' }));
    });
    expect(result.current.isHUDOpen).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'K' }));
    });
    expect(result.current.isHUDOpen).toBe(false);
  });

  it('switches preset profiles and updates parameters', () => {
    const { result } = renderHook(() => useCJKKerning('test-series-cjk'));

    act(() => {
      result.current.selectPreset('furigana_compact');
    });
    expect(result.current.presetName).toBe('furigana_compact');
    expect(result.current.baseKerningEm).toBe(-0.02);
    expect(result.current.trackingRatio).toBe(0.005);

    act(() => {
      result.current.selectPreset('dialogue_whisper');
    });
    expect(result.current.presetName).toBe('dialogue_whisper');
    expect(result.current.baseKerningEm).toBe(0.08);
  });

  it('calculates dynamic kerning depending on CJK complexity', () => {
    // Kanji (0x9F8D) -> expanded
    const kanji = localCalculateCJKKerning(0x9f8d, 0.04, 0.015, -0.02, 0.20, 0.25, true);
    expect(kanji.densityType).toBe('kanji');
    expect(kanji.kerningEm).toBeGreaterThan(0.04);

    // Kana (0x3042) -> tighter
    const kana = localCalculateCJKKerning(0x3042, 0.04, 0.015, -0.02, 0.20, 0.25, true);
    expect(kana.densityType).toBe('kana');
    expect(kana.kerningEm).toBeLessThan(0.04);
  });
});
