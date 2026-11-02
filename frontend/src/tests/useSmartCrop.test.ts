import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSmartCrop } from '../reader/useSmartCrop';

describe('Sprint 84 - useSmartCrop Hook Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default options', () => {
    const { result } = renderHook(() =>
      useSmartCrop({ enableKeyboard: false })
    );

    expect(result.current.isOpen).toBe(false);
    expect(result.current.isEnabled).toBe(true);
    expect(result.current.mode).toBe('dialogue_safe');
    expect(result.current.marginThreshold).toBe(0.96);
    expect(result.current.aspectRatioLock).toBe(false);
    expect(result.current.targetAspectRatio).toBe(0.70);
    expect(result.current.paddingPx).toBe(12);
    expect(result.current.cropBox).toBeNull();
    expect(result.current.marginSavedPct).toBe(0);
    expect(result.current.isCropped).toBe(false);
  });

  it('controls HUD visibility correctly', () => {
    const { result } = renderHook(() =>
      useSmartCrop({ enableKeyboard: false })
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

  it('updates mode, padding, and aspect ratio locks with proper clamping', () => {
    const { result } = renderHook(() =>
      useSmartCrop({ enableKeyboard: false })
    );

    act(() => {
      result.current.setMode('conservative');
    });
    expect(result.current.mode).toBe('conservative');

    act(() => {
      result.current.setPaddingPx(24);
    });
    expect(result.current.paddingPx).toBe(24);

    act(() => {
      result.current.setMarginThreshold(0.92);
    });
    expect(result.current.marginThreshold).toBe(0.92);

    act(() => {
      result.current.toggleAspectRatioLock();
    });
    expect(result.current.aspectRatioLock).toBe(true);

    act(() => {
      result.current.setTargetAspectRatio(0.69);
    });
    expect(result.current.targetAspectRatio).toBe(0.69);
  });

  it('applies crop calculation and computes margin space saved', () => {
    const { result } = renderHook(() =>
      useSmartCrop({ enableKeyboard: false })
    );

    act(() => {
      result.current.applyCrop(1000, 1500, { minX: 0.1, minY: 0.05, maxX: 0.9, maxY: 0.95 });
    });

    expect(result.current.cropBox).not.toBeNull();
    expect(result.current.isCropped).toBe(true);
    expect(result.current.marginSavedPct).toBeGreaterThan(0);

    act(() => {
      result.current.resetCrop();
    });

    expect(result.current.cropBox).toBeNull();
    expect(result.current.isCropped).toBe(false);
    expect(result.current.marginSavedPct).toBe(0);
  });
});
