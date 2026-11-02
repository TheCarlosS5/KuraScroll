import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAnamorphicSeam, localCalculateAnamorphicSeam } from '../reader/useAnamorphicSeam';

describe('useAnamorphicSeam Hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default native preset and hidden HUD', () => {
    const { result } = renderHook(() => useAnamorphicSeam('test-series'));

    expect(result.current.isVisible).toBe(false);
    expect(result.current.profile.aspectRatioMode).toBe('native');
    expect(result.current.profile.unsqueezeFactor).toBe(1.0);
    expect(result.current.profile.seamOverlapPx).toBe(0.75);
    expect(result.current.profile.subpixelSnappingMode).toBe('cumulative_origin');
    expect(result.current.profile.isEnabled).toBe(true);
    expect(result.current.sampleResult.rawHeight).toBe(1200);
    expect(result.current.sampleResult.renderedHeight).toBe(1200);
    expect(result.current.sampleResult.transformCss).toBe('none');
    expect(result.current.sampleResult.marginBottomCss).toBe('-0.75px');
  });

  it('toggles visibility on key U', () => {
    const { result } = renderHook(() => useAnamorphicSeam('test-series'));

    expect(result.current.isVisible).toBe(false);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'u' }));
    });
    expect(result.current.isVisible).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'U' }));
    });
    expect(result.current.isVisible).toBe(false);
  });

  it('switches aspect ratio presets correctly', () => {
    const { result } = renderHook(() => useAnamorphicSeam('test-series'));

    act(() => {
      result.current.setPreset('anamorphic_4_3_to_16_9');
    });
    expect(result.current.profile.aspectRatioMode).toBe('anamorphic_4_3_to_16_9');
    expect(result.current.profile.unsqueezeFactor).toBe(1.3333);
    expect(result.current.sampleResult.renderedHeight).toBe(1600);
    expect(result.current.sampleResult.transformCss).toBe('scaleY(1.3333)');

    act(() => {
      result.current.setPreset('anamorphic_4_3_to_16_10');
    });
    expect(result.current.profile.aspectRatioMode).toBe('anamorphic_4_3_to_16_10');
    expect(result.current.profile.unsqueezeFactor).toBe(1.2000);
    expect(result.current.sampleResult.renderedHeight).toBe(1440);
  });

  it('updates profile parameters dynamically', () => {
    const { result } = renderHook(() => useAnamorphicSeam('test-series'));

    act(() => {
      result.current.updateProfile({ isEnabled: false });
    });
    expect(result.current.profile.isEnabled).toBe(false);
    expect(result.current.sampleResult.transformCss).toBe('none');
    expect(result.current.sampleResult.marginBottomCss).toBe('0px');
  });

  it('localCalculateAnamorphicSeam calculates coordinates and un-squeeze transformations', () => {
    const nativeRes = localCalculateAnamorphicSeam(0, 0, 1000, 'native', 1.0, 0.75, 'cumulative_origin', true);
    expect(nativeRes.renderedHeight).toBe(1000);
    expect(nativeRes.marginBottomCss).toBe('-0.75px');

    const wideRes = localCalculateAnamorphicSeam(0, 0, 1000, 'anamorphic_4_3_to_16_9', 1.0, 1.25, 'cumulative_origin', true);
    expect(wideRes.renderedHeight).toBe(1333);
    expect(wideRes.marginBottomCss).toBe('-1.25px');
    expect(wideRes.transformCss).toBe('scaleY(1.3333)');
  });
});
