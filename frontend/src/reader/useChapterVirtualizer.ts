import { useState, useCallback, useMemo } from 'react';

export interface VirtualizerOptions {
  total: number;
  rowHeight?: number;
  viewportHeight?: number;
  overscan?: number;
}

export interface VirtualizerResult {
  startIndex: number;
  endIndex: number;
  totalHeight: number;
  offsetY: number;
  onScroll: (e: React.UIEvent<HTMLElement>) => void;
  setScrollTop: (top: number) => void;
  scrollTop: number;
}

/**
 * Lightweight, zero-dependency chapter list virtualizer designed for Intel GMA 4500MHD.
 * Maintains exactly ~15-20 active DOM nodes even for 1,000+ chapter series.
 */
export function useChapterVirtualizer({
  total,
  rowHeight = 48,
  viewportHeight = 480,
  overscan = 4,
}: VirtualizerOptions): VirtualizerResult {
  const [scrollTop, setScrollTop] = useState(0);

  const onScroll = useCallback((event: React.UIEvent<HTMLElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  }, []);

  const totalHeight = total * rowHeight;

  const { startIndex, endIndex, offsetY } = useMemo(() => {
    if (total <= 0) {
      return { startIndex: 0, endIndex: 0, offsetY: 0 };
    }

    const firstVisible = Math.floor(scrollTop / rowHeight);
    const visibleCount = Math.ceil(viewportHeight / rowHeight);

    const start = Math.max(0, firstVisible - overscan);
    const end = Math.min(total, firstVisible + visibleCount + overscan);
    const offset = start * rowHeight;

    return {
      startIndex: start,
      endIndex: end,
      offsetY: offset,
    };
  }, [total, rowHeight, viewportHeight, overscan, scrollTop]);

  return {
    startIndex,
    endIndex,
    totalHeight,
    offsetY,
    onScroll,
    setScrollTop,
    scrollTop,
  };
}
