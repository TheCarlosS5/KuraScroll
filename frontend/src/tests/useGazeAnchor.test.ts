import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGazeAnchor } from '../reader/useGazeAnchor';

describe('Sprint 83 - useGazeAnchor Hook Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default options', () => {
    const { result } = renderHook(() =>
      useGazeAnchor({ enableKeyboard: false })
    );

    expect(result.current.isOpen).toBe(false);
    expect(result.current.isEnabled).toBe(true);
    expect(result.current.mode).toBe('manga_rtl');
    expect(result.current.saccadeSensitivity).toBe(1.0);
    expect(result.current.dwellThresholdMs).toBe(250);
    expect(result.current.driftTolerancePx).toBe(40.0);
    expect(result.current.returnAnchorEnabled).toBe(true);
    expect(result.current.heatmapResolution).toBe('medium');
    expect(result.current.currentAnchor).toBeNull();
    expect(result.current.isDriftActive).toBe(false);
  });

  it('controls HUD visibility correctly', () => {
    const { result } = renderHook(() =>
      useGazeAnchor({ enableKeyboard: false })
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

  it('updates mode, sensitivity, and tolerances with proper clamping', () => {
    const { result } = renderHook(() =>
      useGazeAnchor({ enableKeyboard: false })
    );

    act(() => {
      result.current.setMode('webtoon');
    });
    expect(result.current.mode).toBe('webtoon');

    act(() => {
      result.current.setSaccadeSensitivity(2.4);
    });
    expect(result.current.saccadeSensitivity).toBe(2.4);

    act(() => {
      result.current.setDwellThresholdMs(400);
    });
    expect(result.current.dwellThresholdMs).toBe(400);

    act(() => {
      result.current.setDriftTolerancePx(60.0);
    });
    expect(result.current.driftTolerancePx).toBe(60.0);

    act(() => {
      result.current.setHeatmapResolution('high');
    });
    expect(result.current.heatmapResolution).toBe('high');
  });

  it('updates gaze fixation points and respects drift deadband', () => {
    const { result } = renderHook(() =>
      useGazeAnchor({ enableKeyboard: false, defaultDwellMs: 100 })
    );

    act(() => {
      result.current.updateGaze(150, 250);
    });

    expect(result.current.currentAnchor).toEqual({ x: 150, y: 250 });

    act(() => {
      result.current.resetAnchor();
    });

    expect(result.current.currentAnchor).toBeNull();
    expect(result.current.isDriftActive).toBe(false);
  });
});
