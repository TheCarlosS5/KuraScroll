/**
 * KuraScroll Sprint 96: useCreaseShadow Hook Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCreaseShadow } from '../reader/useCreaseShadow';

describe('useCreaseShadow Hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default tankobon_tight preset and proper bounds', () => {
    const { result } = renderHook(() => useCreaseShadow());

    expect(result.current.isEnabled).toBe(true);
    expect(result.current.isHUDVisible).toBe(false);
    expect(result.current.mode).toBe('tankobon_tight');
    expect(result.current.spineShadowIntensity).toBe(0.65);
    expect(result.current.gutterWidthPx).toBe(24);
    expect(result.current.asymmetryRatio).toBe(0.50);
    expect(result.current.isRtl).toBe(true);
    expect(result.current.progressRatio).toBe(0.50);
    expect(result.current.leftGutterWidthPx).toBe(result.current.rightGutterWidthPx);
  });

  it('toggles HUD visibility', () => {
    const { result } = renderHook(() => useCreaseShadow());

    expect(result.current.isHUDVisible).toBe(false);
    act(() => {
      result.current.toggleHUD();
    });
    expect(result.current.isHUDVisible).toBe(true);
    act(() => {
      result.current.setIsHUDVisible(false);
    });
    expect(result.current.isHUDVisible).toBe(false);
  });

  it('switches presets correctly', () => {
    const { result } = renderHook(() => useCreaseShadow());

    act(() => {
      result.current.resetToPreset('magazine_wide');
    });

    expect(result.current.mode).toBe('magazine_wide');
    expect(result.current.spineShadowIntensity).toBe(0.40);
    expect(result.current.gutterWidthPx).toBe(36);
  });

  it('modulates asymmetric gutter width when reading progress shifts', () => {
    const { result } = renderHook(() => useCreaseShadow());

    act(() => {
      result.current.setProgressRatio(0.00); // Volume start
    });

    // In RTL start: left block is thicker than right block
    expect(result.current.leftGutterWidthPx).toBeGreaterThan(result.current.rightGutterWidthPx);
    expect(result.current.leftShadowOpacity).toBeGreaterThan(result.current.rightShadowOpacity);
  });

  it('toggles HUD on "c" keydown event', () => {
    const { result } = renderHook(() => useCreaseShadow());

    expect(result.current.isHUDVisible).toBe(false);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'c' }));
    });
    expect(result.current.isHUDVisible).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'C' }));
    });
    expect(result.current.isHUDVisible).toBe(false);
  });
});
