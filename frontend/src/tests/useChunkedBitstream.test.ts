/**
 * KuraScroll Sprint 87: useChunkedBitstream Hook Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChunkedBitstream } from '../reader/useChunkedBitstream';

describe('useChunkedBitstream Hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default webtoon dimensions and slices', () => {
    const { result } = renderHook(() =>
      useChunkedBitstream({ initialWidth: 1440, initialHeight: 8000 })
    );

    expect(result.current.isEnabled).toBe(true);
    expect(result.current.isHUDVisible).toBe(false);
    expect(result.current.preset).toBe('webtoon_conservative');
    expect(result.current.totalWidth).toBe(1440);
    expect(result.current.totalHeight).toBe(8000);
    // 1440 width => 2 cols of 1024; 8000 height => 8 rows of 1024 => 16 slices
    expect(result.current.totalSlices).toBe(16);
    expect(result.current.slices.length).toBe(16);
    expect(result.current.isOversized).toBe(true);
    expect(result.current.idleBudgetMs).toBe(8.0);
  });

  it('toggles HUD visibility', () => {
    const { result } = renderHook(() => useChunkedBitstream());

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

  it('switches slicing preset and recalculates slice count', () => {
    const { result } = renderHook(() =>
      useChunkedBitstream({ initialWidth: 1000, initialHeight: 2000 })
    );

    // Initial conservative (1024px): 1 col * 2 rows = 2 slices
    expect(result.current.totalSlices).toBe(2);

    // Switch to low_vram_aggressive (512px): 2 cols * 4 rows = 8 slices
    act(() => {
      result.current.setPreset('low_vram_aggressive');
    });

    expect(result.current.preset).toBe('low_vram_aggressive');
    expect(result.current.idleBudgetMs).toBe(5.0);
    expect(result.current.totalSlices).toBe(8);

    // Switch to high_fidelity (2048px): 1 col * 1 row = 1 slice
    act(() => {
      result.current.setPreset('high_fidelity');
    });

    expect(result.current.preset).toBe('high_fidelity');
    expect(result.current.totalSlices).toBe(1);
  });

  it('updates image dimensions dynamically', () => {
    const { result } = renderHook(() =>
      useChunkedBitstream({ initialWidth: 800, initialHeight: 600 })
    );

    expect(result.current.totalSlices).toBe(1);
    expect(result.current.isOversized).toBe(false);

    act(() => {
      result.current.updateImageDimensions(1440, 10000);
    });

    expect(result.current.totalWidth).toBe(1440);
    expect(result.current.totalHeight).toBe(10000);
    expect(result.current.isOversized).toBe(true);
    // 2 cols * 10 rows = 20 slices
    expect(result.current.totalSlices).toBe(20);
  });
});
