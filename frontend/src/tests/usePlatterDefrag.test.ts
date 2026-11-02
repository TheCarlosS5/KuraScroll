import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePlatterDefrag } from '../reader/usePlatterDefrag.js';

describe('Sprint 63 - usePlatterDefrag Hook Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default idle state', () => {
    const { result } = renderHook(() => usePlatterDefrag());

    expect(result.current.status).toBe('idle');
    expect(result.current.isOpen).toBe(false);
    expect(result.current.report).toBeNull();
    expect(result.current.lastResult).toBeNull();
    expect(result.current.pli).toBe(1.0);
    expect(result.current.fragmentationPercent).toBe(0);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('analyzes series PLI via API and updates report', async () => {
    const mockReport = {
      seriesId: 'ser-test-1',
      totalChapters: 25,
      pli: 0.65,
      fragmentationPercent: 35.0,
      isFragmented: true,
      recommendation: 'DEFRAGMENTATION_RECOMMENDED' as const,
      estimatedSeekReductionPercent: 22.3,
      measuredDurationMs: 1.2,
    };

    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({
        success: true,
        report: mockReport,
      }),
    });
    global.fetch = mockFetch;

    const { result } = renderHook(() => usePlatterDefrag({ seriesId: 'ser-test-1' }));

    await act(async () => {
      await result.current.analyzeSeries();
    });

    expect(result.current.report).toEqual(mockReport);
    expect(result.current.pli).toBe(0.65);
    expect(result.current.fragmentationPercent).toBe(35.0);
    expect(result.current.status).toBe('idle');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/storage/platter/pli?seriesId=ser-test-1')
    );
  });

  it('optimizes series platter layout and updates status to complete', async () => {
    const mockResult = {
      seriesId: 'ser-test-1',
      initialPli: 0.65,
      optimizedPli: 0.98,
      chaptersProcessed: 25,
      bytesReordered: 50 * 1024 * 1024,
      durationMs: 450,
    };

    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({
        success: true,
        result: mockResult,
      }),
    });
    global.fetch = mockFetch;

    const { result } = renderHook(() => usePlatterDefrag({ seriesId: 'ser-test-1' }));

    await act(async () => {
      await result.current.optimizeSeries();
    });

    expect(result.current.status).toBe('complete');
    expect(result.current.lastResult).toEqual(mockResult);
    expect(result.current.pli).toBe(0.98);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/storage/platter/optimize'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('handles API error during optimization gracefully', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 500,
      ok: false,
    });
    global.fetch = mockFetch;

    const { result } = renderHook(() => usePlatterDefrag({ seriesId: 'ser-test-err' }));

    await act(async () => {
      await result.current.optimizeSeries();
    });

    expect(result.current.error).toContain('Failed to optimize series platter: HTTP 500');
    expect(result.current.status).toBe('idle');
  });

  it('manages modal visibility transitions via open, close, and toggleOpen', () => {
    const { result } = renderHook(() => usePlatterDefrag());

    expect(result.current.isOpen).toBe(false);

    act(() => {
      result.current.open();
    });
    expect(result.current.isOpen).toBe(true);

    act(() => {
      result.current.toggleOpen();
    });
    expect(result.current.isOpen).toBe(false);

    act(() => {
      result.current.open();
    });
    expect(result.current.isOpen).toBe(true);

    act(() => {
      result.current.close();
    });
    expect(result.current.isOpen).toBe(false);
  });
});
