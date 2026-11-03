import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useTilePrefetch,
  RING_CAPACITY,
} from '../reader/useTilePrefetch';

describe('useTilePrefetch Hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default manga_rtl preset and closed HUD', () => {
    const { result } = renderHook(() => useTilePrefetch('test-series-tp'));

    expect(result.current.isHUDOpen).toBe(false);
    expect(result.current.readingFlow).toBe('manga_rtl');
    expect(result.current.predictionHorizonMs).toBe(350);
    expect(result.current.hysteresisThreshold).toBe(0.65);
    expect(result.current.isEnabled).toBe(true);
    expect(result.current.ringSlots.length).toBe(RING_CAPACITY);
    expect(result.current.cachedCount).toBe(0);
  });

  it('toggles HUD on keyboard key P / p', () => {
    const { result } = renderHook(() => useTilePrefetch('test-series-tp'));

    expect(result.current.isHUDOpen).toBe(false);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p' }));
    });
    expect(result.current.isHUDOpen).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'P' }));
    });
    expect(result.current.isHUDOpen).toBe(false);
  });

  it('switches flow presets and updates parameters', () => {
    const { result } = renderHook(() => useTilePrefetch('test-series-tp'));

    act(() => {
      result.current.selectPreset('webtoon_vertical');
    });
    expect(result.current.readingFlow).toBe('webtoon_vertical');
    expect(result.current.predictionHorizonMs).toBe(500);
    expect(result.current.hysteresisThreshold).toBe(0.60);

    act(() => {
      result.current.selectPreset('cinematic_dynamic');
    });
    expect(result.current.readingFlow).toBe('cinematic_dynamic');
    expect(result.current.predictionHorizonMs).toBe(400);
    expect(result.current.hysteresisThreshold).toBe(0.70);
  });

  it('evaluates prefetch candidate decisions and updates telemetry', () => {
    const { result } = renderHook(() => useTilePrefetch('test-series-tp'));

    act(() => {
      result.current.evaluateCandidate(101, 0.85);
    });

    expect(result.current.lastDecision?.shouldPrefetch).toBe(true);
    expect(result.current.lastDecision?.selectedTileId).toBe(101);
    expect(result.current.cachedCount).toBe(1);
    expect(result.current.telemetry.prefetches).toBe(1);

    // Same candidate -> cache hit
    act(() => {
      result.current.evaluateCandidate(101, 0.90);
    });
    expect(result.current.lastDecision?.shouldPrefetch).toBe(false);
    expect(result.current.telemetry.cacheHits).toBe(1);
    expect(result.current.hitRatio).toBeGreaterThan(0);
  });
});
