/**
 * KuraScroll Sprint 90: useHistoryScrubber Hook Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHistoryScrubber } from '../reader/useHistoryScrubber';

describe('useHistoryScrubber Hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default webtoon_continuous mode and proper bounds', () => {
    const { result } = renderHook(() => useHistoryScrubber({ totalItems: 100, initialIndex: 10 }));

    expect(result.current.isEnabled).toBe(true);
    expect(result.current.isHUDVisible).toBe(false);
    expect(result.current.scrubberMode).toBe('webtoon_continuous');
    expect(result.current.currentIndex).toBe(10);
    expect(result.current.totalItems).toBe(100);
    expect(result.current.isAtStart).toBe(false);
    expect(result.current.isAtEnd).toBe(false);
    expect(result.current.normalizedPosition).toBeCloseTo(10 / 99, 2);
  });

  it('toggles HUD visibility', () => {
    const { result } = renderHook(() => useHistoryScrubber());

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

  it('scrubs to ratio in LTR and RTL modes', () => {
    const onScrubCommit = vi.fn();
    const { result } = renderHook(() => useHistoryScrubber({ totalItems: 100, onScrubCommit }));

    act(() => {
      result.current.scrubToRatio(0.5);
    });

    expect(result.current.currentIndex).toBe(50);
    expect(onScrubCommit).toHaveBeenCalledWith(50);

    // Switch to RTL mode
    act(() => {
      result.current.setScrubberMode('manga_rtl_continuous');
    });

    act(() => {
      result.current.scrubToRatio(0.2); // In RTL, 0.2 from left means 80% through the chapter
    });

    expect(result.current.currentIndex).toBe(79);
  });

  it('scrubs by delta with velocity multiplier', () => {
    const onScrubCommit = vi.fn();
    const { result } = renderHook(() => useHistoryScrubber({ totalItems: 100, initialIndex: 20, onScrubCommit }));

    act(() => {
      result.current.setVelocityMultiplier(2.0);
    });

    act(() => {
      result.current.scrubDelta(5); // 5 * 2.0 = 10
    });

    expect(result.current.currentIndex).toBe(30);
    expect(onScrubCommit).toHaveBeenCalledWith(30);
  });

  it('detects boundary extremes (start and end)', () => {
    const { result } = renderHook(() => useHistoryScrubber({ totalItems: 50, initialIndex: 0 }));

    expect(result.current.isAtStart).toBe(true);
    expect(result.current.isAtEnd).toBe(false);

    act(() => {
      result.current.setCurrentIndex(49);
    });

    expect(result.current.isAtStart).toBe(false);
    expect(result.current.isAtEnd).toBe(true);
  });
});
