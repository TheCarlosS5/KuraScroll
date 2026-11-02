import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDialogueSearch } from '../reader/useDialogueSearch.js';

describe('Sprint 60 - useDialogueSearch Hook Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('initializes with default clean state', () => {
    const { result } = renderHook(() => useDialogueSearch());

    expect(result.current.query).toBe('');
    expect(result.current.results).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.protectSpoilers).toBe(true);
    expect(result.current.totalMatches).toBe(0);
  });

  it('debounces query changes and executes search', async () => {
    const mockResults = [
      {
        bubbleId: 'bub-1',
        chapterId: 'ch-1',
        chapterNumber: 1,
        pageNumber: 5,
        text: '海賊王に俺はなる！',
        boundingBox: { x: 10, y: 10, w: 20, h: 20 },
        bubbleType: 'SPEECH',
        language: 'ja',
        confidence: 0.98,
      },
    ];

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        count: 1,
        queryTimeMs: 0.42,
        results: mockResults,
      }),
    });
    global.fetch = mockFetch;

    const { result } = renderHook(() =>
      useDialogueSearch({ currentChapterNumber: 5 })
    );

    act(() => {
      result.current.setQuery('海賊王');
    });

    expect(mockFetch).not.toHaveBeenCalled();

    // Fast-forward debounce timer (150ms)
    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toContain('q=%E6%B5%B7%E8%B3%8A%E7%8E%8B');
    expect(mockFetch.mock.calls[0][0]).toContain('maxChapter=5');

    expect(result.current.results.length).toBe(1);
    expect(result.current.results[0].text).toBe('海賊王に俺はなる！');
    expect(result.current.totalMatches).toBe(1);
    expect(result.current.queryTimeMs).toBe(0.42);
  });

  it('allows disabling anti-spoiler protection', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        count: 0,
        results: [],
      }),
    });
    global.fetch = mockFetch;

    const { result } = renderHook(() =>
      useDialogueSearch({ currentChapterNumber: 3 })
    );

    act(() => {
      result.current.setProtectSpoilers(false);
      result.current.setQuery('テスト');
    });

    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    // Should NOT have maxChapter param since protectSpoilers was disabled
    expect(mockFetch.mock.calls[0][0]).not.toContain('maxChapter=');
  });

  it('handles fetch error and updates error state', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ message: 'Database query timeout' }),
    });
    global.fetch = mockFetch;

    const { result } = renderHook(() => useDialogueSearch());

    act(() => {
      result.current.setQuery('エラーテスト');
    });

    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current.error).toBe('Database query timeout');
    expect(result.current.results).toEqual([]);
  });

  it('clears query and results on clear()', () => {
    const { result } = renderHook(() => useDialogueSearch());

    act(() => {
      result.current.setQuery('テキスト');
    });

    act(() => {
      result.current.clear();
    });

    expect(result.current.query).toBe('');
    expect(result.current.results).toEqual([]);
    expect(result.current.totalMatches).toBe(0);
  });
});
