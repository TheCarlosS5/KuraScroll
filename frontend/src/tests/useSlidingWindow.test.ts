/**
 * KuraScroll Sprint 86: useSlidingWindow Hook Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSlidingWindow } from '../reader/useSlidingWindow';

describe('useSlidingWindow Hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default conservative mode', () => {
    const { result } = renderHook(() =>
      useSlidingWindow({ totalPages: 50, initialPage: 10 })
    );

    expect(result.current.isEnabled).toBe(true);
    expect(result.current.isHUDVisible).toBe(false);
    expect(result.current.mode).toBe('conservative');
    expect(result.current.currentIndex).toBe(10);
    // conservative: 2 back, 3 forward => [8, 13]
    expect(result.current.startIndex).toBe(8);
    expect(result.current.endIndex).toBe(13);
    expect(result.current.activeCount).toBe(6);
    expect(result.current.activeIndices).toEqual([8, 9, 10, 11, 12, 13]);
    expect(result.current.prefetchIndices).toEqual([11, 12, 13]);
    expect(result.current.evictedCount).toBe(44);
  });

  it('toggles HUD visibility', () => {
    const { result } = renderHook(() =>
      useSlidingWindow({ totalPages: 20 })
    );

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

  it('updates viewport index dynamically', () => {
    const { result } = renderHook(() =>
      useSlidingWindow({ totalPages: 30, initialPage: 0 })
    );

    expect(result.current.startIndex).toBe(0);
    expect(result.current.endIndex).toBe(3); // 0 + 3 forward

    act(() => {
      result.current.updateViewportIndex(15);
    });

    expect(result.current.currentIndex).toBe(15);
    expect(result.current.startIndex).toBe(13);
    expect(result.current.endIndex).toBe(18);
  });

  it('switches buffer mode and recalculates active window', () => {
    const { result } = renderHook(() =>
      useSlidingWindow({ totalPages: 40, initialPage: 10, initialMode: 'conservative' })
    );

    // Switch to aggressive: 1 back, 2 fwd => [9, 12]
    act(() => {
      result.current.setMode('aggressive');
    });

    expect(result.current.mode).toBe('aggressive');
    expect(result.current.startIndex).toBe(9);
    expect(result.current.endIndex).toBe(12);
    expect(result.current.activeCount).toBe(4);

    // Switch to preload_heavy: 3 back, 5 fwd => [7, 15]
    act(() => {
      result.current.setMode('preload_heavy');
    });

    expect(result.current.mode).toBe('preload_heavy');
    expect(result.current.startIndex).toBe(7);
    expect(result.current.endIndex).toBe(15);
    expect(result.current.activeCount).toBe(9);
  });

  it('correctly determines isPageActive status', () => {
    const { result } = renderHook(() =>
      useSlidingWindow({ totalPages: 20, initialPage: 5, initialMode: 'aggressive' })
    );
    // aggressive at page 5: [4, 7]
    expect(result.current.isPageActive(4)).toBe(true);
    expect(result.current.isPageActive(5)).toBe(true);
    expect(result.current.isPageActive(7)).toBe(true);
    expect(result.current.isPageActive(3)).toBe(false);
    expect(result.current.isPageActive(8)).toBe(false);
  });
});
