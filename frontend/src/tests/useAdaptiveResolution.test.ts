import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useAdaptiveResolution,
  computeAdaptiveTier,
} from '../reader/useAdaptiveResolution.js';

describe('Sprint 58 - useAdaptiveResolution Unit Tests', () => {
  it('computes adaptive tier correctly based on width and DPR', () => {
    // Mobile / small viewport
    expect(computeAdaptiveTier(390, 2)).toBe(800); // 780 effective -> 800
    expect(computeAdaptiveTier(480, 1)).toBe(800);

    // Laptop / standard 720p (sweet spot for GMA 4500MHD)
    expect(computeAdaptiveTier(1200, 1)).toBe(1200);
    expect(computeAdaptiveTier(1366, 1)).toBe(1200);

    // Desktop / 1080p+
    expect(computeAdaptiveTier(1920, 1)).toBe(1600);
    expect(computeAdaptiveTier(1000, 2)).toBe(1600); // 2000 effective -> 1600
  });

  it('allows manual override of resolution tier and updates tierName', () => {
    const { result } = renderHook(() => useAdaptiveResolution('auto'));

    expect(result.current.isAuto).toBe(true);

    act(() => {
      result.current.setOverride(800);
    });

    expect(result.current.targetWidth).toBe(800);
    expect(result.current.tierName).toBe('mobile');
    expect(result.current.isAuto).toBe(false);

    act(() => {
      result.current.setOverride(1600);
    });

    expect(result.current.targetWidth).toBe(1600);
    expect(result.current.tierName).toBe('desktop');

    act(() => {
      result.current.setOverride('auto');
    });

    expect(result.current.isAuto).toBe(true);
  });

  it('builds valid transcode URL with query parameters', () => {
    const { result } = renderHook(() => useAdaptiveResolution(1200));

    const url = result.current.buildTranscodeUrl('ch_101', 5);
    expect(url).toBe('/api/v1/chapters/ch_101/pages/5/transcode?w=1200');
  });
});
