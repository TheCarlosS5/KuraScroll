import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpatialHeatmap } from '../reader/useSpatialHeatmap.js';

describe('Sprint 61 - useSpatialHeatmap Hook Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('initializes with default state', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 404,
      ok: false,
    });
    global.fetch = mockFetch;

    let hookResult: any;
    await act(async () => {
      hookResult = renderHook(() =>
        useSpatialHeatmap({
          chapterId: 'ch-test-1',
          pageNumber: 1,
          autoRecord: false,
        })
      );
    });

    const { result } = hookResult;
    expect(result.current.isVisible).toBe(false);
    expect(result.current.opacity).toBe(0.55);
    expect(result.current.matrix2D.length).toBe(16);
    expect(result.current.totalDwellMs).toBe(0);
    expect(result.current.peakIntensity).toBe(0);
  });

  it('toggles visibility and modifies opacity', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 404,
      ok: false,
    });
    global.fetch = mockFetch;

    let hookResult: any;
    await act(async () => {
      hookResult = renderHook(() =>
        useSpatialHeatmap({
          chapterId: 'ch-test-1',
          pageNumber: 1,
          autoRecord: false,
        })
      );
    });

    const { result } = hookResult;
    act(() => {
      result.current.toggleVisibility();
    });
    expect(result.current.isVisible).toBe(true);

    act(() => {
      result.current.setOpacity(0.75);
    });
    expect(result.current.opacity).toBe(0.75);
  });

  it('toggles visibility via keydown "H"', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 404,
      ok: false,
    });
    global.fetch = mockFetch;

    let hookResult: any;
    await act(async () => {
      hookResult = renderHook(() =>
        useSpatialHeatmap({
          chapterId: 'ch-test-1',
          pageNumber: 1,
          autoRecord: false,
        })
      );
    });

    const { result } = hookResult;
    expect(result.current.isVisible).toBe(false);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'h' }));
    });
    expect(result.current.isVisible).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'H' }));
    });
    expect(result.current.isVisible).toBe(false);
  });

  it('records focus points and boxes via background fetch', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ success: true }),
    });
    global.fetch = mockFetch;

    let hookResult: any;
    await act(async () => {
      hookResult = renderHook(() =>
        useSpatialHeatmap({
          chapterId: 'ch-focus-1',
          pageNumber: 3,
          autoRecord: false,
        })
      );
    });

    const { result } = hookResult;

    act(() => {
      result.current.recordFocusPoint(50, 50, 400);
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/analytics/spatial-heatmap/record'),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"focusType":"KINETIC_POINT"'),
      })
    );

    act(() => {
      result.current.recordFocusBox({ x: 20, y: 30, w: 25, h: 25 }, 800, 'BUBBLE');
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/analytics/spatial-heatmap/record'),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"focusType":"BUBBLE"'),
      })
    );
  });
});
