import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useDeepZoomPanScan,
  computeClientVisibleTiles,
  DeepZoomManifest,
} from '../reader/useDeepZoomPanScan';

describe('Sprint 66 - useDeepZoomPanScan Hook Tests', () => {
  const mockManifest: DeepZoomManifest = {
    chapterId: 'ch_test_hook',
    pageNumber: 1,
    isPyramidal: true,
    originalWidth: 6000,
    originalHeight: 4000,
    tileSize: 512,
    overlap: 0,
    format: 'webp',
    maxLevel: 4,
    totalTiles: 147,
    levels: [
      { level: 0, width: 375, height: 250, cols: 1, rows: 1, scale: 0.0625 },
      { level: 1, width: 750, height: 500, cols: 2, rows: 1, scale: 0.125 },
      { level: 2, width: 1500, height: 1000, cols: 3, rows: 2, scale: 0.25 },
      { level: 3, width: 3000, height: 2000, cols: 6, rows: 4, scale: 0.5 },
      { level: 4, width: 6000, height: 4000, cols: 12, rows: 8, scale: 1.0 },
    ],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default values and deep-zoom inactive', () => {
    const { result } = renderHook(() =>
      useDeepZoomPanScan({ manifest: mockManifest, enableKeyboard: false })
    );

    expect(result.current.isActive).toBe(false);
    expect(result.current.panX).toBe(0);
    expect(result.current.panY).toBe(0);
    expect(result.current.scale).toBe(1.0);
    expect(result.current.level).toBe(3);
    expect(result.current.visibleTiles.length).toBeGreaterThan(0);
  });

  it('toggles deep-zoom activation on demand', () => {
    const { result } = renderHook(() =>
      useDeepZoomPanScan({ manifest: mockManifest, enableKeyboard: false })
    );

    act(() => {
      result.current.toggleDeepZoom();
    });
    expect(result.current.isActive).toBe(true);

    act(() => {
      result.current.toggleDeepZoom();
    });
    expect(result.current.isActive).toBe(false);
  });

  it('zooms in and out with bounds clamping', () => {
    const { result } = renderHook(() =>
      useDeepZoomPanScan({
        manifest: mockManifest,
        minScale: 0.5,
        maxScale: 3.0,
        enableKeyboard: false,
      })
    );

    // Zoom in
    act(() => {
      result.current.zoomIn(1.0);
    });
    expect(result.current.scale).toBe(2.0);
    expect(result.current.level).toBe(4); // Switches to max level 4

    // Clamps at maxScale 3.0
    act(() => {
      result.current.zoomIn(2.0);
    });
    expect(result.current.scale).toBe(3.0);

    // Zoom out
    act(() => {
      result.current.zoomOut(2.0);
    });
    expect(result.current.scale).toBe(1.0);

    // Reset view
    act(() => {
      result.current.resetView();
    });
    expect(result.current.scale).toBe(1.0);
    expect(result.current.panX).toBe(0);
    expect(result.current.panY).toBe(0);
  });

  it('pans view with panBy', () => {
    const { result } = renderHook(() =>
      useDeepZoomPanScan({ manifest: mockManifest, enableKeyboard: false })
    );

    act(() => {
      result.current.panBy(100, -50);
    });
    expect(result.current.panX).toBe(100);
    expect(result.current.panY).toBe(-50);
  });

  it('handles pointer drag gestures smoothly', () => {
    const { result } = renderHook(() =>
      useDeepZoomPanScan({ manifest: mockManifest, enableKeyboard: false })
    );

    act(() => {
      result.current.handlePointerDown(100, 100);
    });
    expect(result.current.isDragging).toBe(true);

    act(() => {
      result.current.handlePointerMove(150, 120);
    });
    expect(result.current.panX).toBe(50);
    expect(result.current.panY).toBe(20);

    act(() => {
      result.current.handlePointerUp();
    });
    expect(result.current.isDragging).toBe(false);
  });

  it('handles fallback single-tile manifest for normal manga pages (<= 2048px)', () => {
    const standardManifest: DeepZoomManifest = {
      chapterId: 'ch_normal',
      pageNumber: 1,
      isPyramidal: false,
      originalWidth: 1200,
      originalHeight: 1800,
      tileSize: 512,
      overlap: 0,
      format: 'webp',
      maxLevel: 0,
      totalTiles: 1,
      levels: [
        { level: 0, width: 1200, height: 1800, cols: 1, rows: 1, scale: 1.0 },
      ],
    };

    const res = computeClientVisibleTiles(0, 0, 1.0, 1920, 1080, standardManifest);
    expect(res.level).toBe(0);
    expect(res.totalVisible).toBe(1);
    expect(res.tiles[0].url).toContain('/api/v1/tiles/ch_normal/1/0/0_0.webp');
  });
});
