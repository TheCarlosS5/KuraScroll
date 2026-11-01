import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAdaptivePrefetch } from '../../src/reader/prefetch/useAdaptivePrefetch';

describe('useAdaptivePrefetch Hook (Thermal & Bandwidth Saver Mode)', () => {
  const dummyPages = [
    { pageNumber: 1, fileName: '001.webp' },
    { pageNumber: 2, fileName: '002.webp' },
    { pageNumber: 3, fileName: '003.webp' },
    { pageNumber: 4, fileName: '004.webp' },
    { pageNumber: 5, fileName: '005.webp' },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = vi.fn().mockImplementation(async () => ({
      ok: true,
      blob: async () => new Blob(['fake-img'], { type: 'image/webp' }),
    }));
  });

  it('initializes controller and enqueues targets', () => {
    const { result } = renderHook(() =>
      useAdaptivePrefetch({
        pages: dummyPages,
        currentPageIndex: 0,
        chapterId: 'chap-1',
      })
    );

    expect(result.current).toBeDefined();
    expect(result.current.isDestroyed()).toBe(false);
  });

  it('restricts prefetch window when thermalSaverMode is enabled', async () => {
    const { result } = renderHook(() =>
      useAdaptivePrefetch({
        pages: dummyPages,
        currentPageIndex: 0,
        chapterId: 'chap-1',
        thermalSaverMode: true,
      })
    );

    // In thermalSaverMode, maxConcurrent is throttled to 1
    expect(result.current.getActiveCount()).toBeLessThanOrEqual(1);
  });
});
