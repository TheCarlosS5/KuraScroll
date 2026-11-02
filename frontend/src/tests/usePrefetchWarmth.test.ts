import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  usePrefetchWarmth,
  prefetchWarmthStore,
} from '../reader/usePrefetchWarmth.js';

describe('Sprint 59 - usePrefetchWarmth Hook & Store Tests', () => {
  beforeEach(() => {
    prefetchWarmthStore.clear();
  });

  it('initializes with cold warmth state', () => {
    const { result } = renderHook(() => usePrefetchWarmth('chap-1', 1, 1200));

    expect(result.current.warmth).toBe('cold');
    expect(result.current.isHot).toBe(false);
    expect(result.current.isWarming).toBe(false);
  });

  it('updates reactively when warmth is set to hot', () => {
    const { result } = renderHook(() => usePrefetchWarmth('chap-1', 1, 1200));

    act(() => {
      result.current.setWarmth('hot');
    });

    expect(result.current.warmth).toBe('hot');
    expect(result.current.isHot).toBe(true);
    expect(result.current.isWarming).toBe(false);
  });

  it('updates reactively when warmth is set to warming', () => {
    const { result } = renderHook(() => usePrefetchWarmth('chap-1', 2, 800));

    act(() => {
      result.current.setWarmth('warming');
    });

    expect(result.current.warmth).toBe('warming');
    expect(result.current.isHot).toBe(false);
    expect(result.current.isWarming).toBe(true);
  });

  it('subscribes correctly to external store updates across multiple hooks', () => {
    const { result: hook1 } = renderHook(() => usePrefetchWarmth('chap-shared', 5, 1200));
    const { result: hook2 } = renderHook(() => usePrefetchWarmth('chap-shared', 5, 1200));

    expect(hook1.current.warmth).toBe('cold');
    expect(hook2.current.warmth).toBe('cold');

    act(() => {
      prefetchWarmthStore.setWarmth('chap-shared', 5, 1200, 'hot');
    });

    expect(hook1.current.warmth).toBe('hot');
    expect(hook2.current.warmth).toBe('hot');
  });

  it('dispatches notifyNavigation via triggerPrefetch and updates candidate states', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        candidates: [
          { chapterId: 'chap-1', pageNumber: 2, targetWidth: 1200 },
          { chapterId: 'chap-1', pageNumber: 3, targetWidth: 1200 },
        ],
      }),
    });
    global.fetch = mockFetch;

    const { result } = renderHook(() => usePrefetchWarmth('chap-1', 1, 1200));

    await act(async () => {
      await result.current.triggerPrefetch({ totalPages: 10 });
    });

    // Current page was marked hot
    expect(result.current.warmth).toBe('hot');

    // Predicted candidates marked warming in store
    expect(prefetchWarmthStore.getSnapshot('chap-1:2:1200')).toBe('warming');
    expect(prefetchWarmthStore.getSnapshot('chap-1:3:1200')).toBe('warming');
  });
});
