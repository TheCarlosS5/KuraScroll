import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePageSplitStitch } from '../reader/usePageSplitStitch';

describe('Sprint 76 - usePageSplitStitch Hook Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default options', () => {
    const { result } = renderHook(() =>
      usePageSplitStitch({ enableKeyboard: false })
    );

    expect(result.current.isOpen).toBe(false);
    expect(result.current.isEnabled).toBe(true);
    expect(result.current.mode).toBe('none');
    expect(result.current.splitRatio).toBe(0.50);
    expect(result.current.stitchGapPx).toBe(0);
  });

  it('controls HUD visibility correctly', () => {
    const { result } = renderHook(() =>
      usePageSplitStitch({ enableKeyboard: false })
    );

    expect(result.current.isOpen).toBe(false);

    act(() => {
      result.current.openHUD();
    });
    expect(result.current.isOpen).toBe(true);

    act(() => {
      result.current.closeHUD();
    });
    expect(result.current.isOpen).toBe(false);

    act(() => {
      result.current.toggleHUD();
    });
    expect(result.current.isOpen).toBe(true);
  });

  it('switches mode between none, split_rtl, split_ltr, and stitch_webtoon', () => {
    const { result } = renderHook(() =>
      usePageSplitStitch({ enableKeyboard: false })
    );

    act(() => {
      result.current.setMode('split_rtl');
    });
    expect(result.current.mode).toBe('split_rtl');

    act(() => {
      result.current.setMode('stitch_webtoon');
    });
    expect(result.current.mode).toBe('stitch_webtoon');
  });

  it('updates splitRatio and stitchGapPx within clamped bounds', () => {
    const { result } = renderHook(() =>
      usePageSplitStitch({ enableKeyboard: false })
    );

    act(() => {
      result.current.setSplitRatio(0.55);
    });
    expect(result.current.splitRatio).toBe(0.55);

    act(() => {
      result.current.setSplitRatio(1.5); // Should clamp to 0.80
    });
    expect(result.current.splitRatio).toBe(0.80);

    act(() => {
      result.current.setStitchGapPx(8);
    });
    expect(result.current.stitchGapPx).toBe(8);

    act(() => {
      result.current.setStitchGapPx(500); // Should clamp to 200
    });
    expect(result.current.stitchGapPx).toBe(200);
  });

  it('resets settings to default values', () => {
    const { result } = renderHook(() =>
      usePageSplitStitch({ enableKeyboard: false })
    );

    act(() => {
      result.current.setMode('split_rtl');
      result.current.setSplitRatio(0.45);
      result.current.setStitchGapPx(10);
      result.current.toggleEnabled();
    });

    expect(result.current.isEnabled).toBe(false);
    expect(result.current.mode).toBe('split_rtl');

    act(() => {
      result.current.resetToDefaults();
    });

    expect(result.current.isEnabled).toBe(true);
    expect(result.current.mode).toBe('none');
    expect(result.current.splitRatio).toBe(0.50);
    expect(result.current.stitchGapPx).toBe(0);
  });
});
