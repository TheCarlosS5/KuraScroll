import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChapterVirtualizer } from '../../src/reader/useChapterVirtualizer';

describe('useChapterVirtualizer Hook Unit Suite (Intel GMA 4500MHD Target)', () => {
  it('computes correct initial slice with overscan for 1,000 chapters', () => {
    const { result } = renderHook(() =>
      useChapterVirtualizer({
        total: 1000,
        rowHeight: 48,
        viewportHeight: 480,
        overscan: 4,
      })
    );

    expect(result.current.totalHeight).toBe(48000); // 1000 * 48
    expect(result.current.startIndex).toBe(0);
    // 0 visible + ceil(480/48 = 10) + overscan(4) = 14
    expect(result.current.endIndex).toBe(14);
    expect(result.current.offsetY).toBe(0);
  });

  it('updates window slice and offsetY on simulated scroll event', () => {
    const { result } = renderHook(() =>
      useChapterVirtualizer({
        total: 500,
        rowHeight: 48,
        viewportHeight: 480,
        overscan: 3,
      })
    );

    // Scroll down 480px (10 rows)
    act(() => {
      result.current.onScroll({
        currentTarget: { scrollTop: 480 },
      } as any);
    });

    // firstVisible = floor(480 / 48) = 10
    // visibleCount = ceil(480 / 48) = 10
    // startIndex = max(0, 10 - 3) = 7
    // endIndex = min(500, 10 + 10 + 3) = 23
    // offsetY = 7 * 48 = 336
    expect(result.current.startIndex).toBe(7);
    expect(result.current.endIndex).toBe(23);
    expect(result.current.offsetY).toBe(336);
  });

  it('handles empty chapters gracefully with zero height and zero slice', () => {
    const { result } = renderHook(() =>
      useChapterVirtualizer({
        total: 0,
        rowHeight: 48,
        viewportHeight: 480,
      })
    );

    expect(result.current.totalHeight).toBe(0);
    expect(result.current.startIndex).toBe(0);
    expect(result.current.endIndex).toBe(0);
    expect(result.current.offsetY).toBe(0);
  });
});
