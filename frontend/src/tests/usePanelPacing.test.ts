/**
 * KuraScroll Sprint 99: usePanelPacing Hook Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePanelPacing } from '../reader/usePanelPacing';

describe('usePanelPacing Hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default cinematic_smooth preset and proper metrics', () => {
    const { result } = renderHook(() => usePanelPacing());

    expect(result.current.isEnabled).toBe(true);
    expect(result.current.isHUDVisible).toBe(false);
    expect(result.current.mode).toBe('cinematic_smooth');
    expect(result.current.transitionDurationMs).toBe(280);
    expect(result.current.zoomOvershootRatio).toBe(1.05);
    expect(result.current.edgePaddingPx).toBe(16);
    expect(result.current.isMotionReduced).toBe(false);
    expect(result.current.scale).toBeGreaterThan(0);
    expect(result.current.transformCss).toContain('translate3d');
    expect(result.current.transitionCss).toContain('transform 280ms');
    expect(result.current.isOvershootActive).toBe(true);
  });

  it('toggles HUD visibility', () => {
    const { result } = renderHook(() => usePanelPacing());

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
    const { result } = renderHook(() => usePanelPacing());

    act(() => {
      result.current.resetToPreset('dynamic_action');
    });

    expect(result.current.mode).toBe('dynamic_action');
    expect(result.current.transitionDurationMs).toBe(180);
    expect(result.current.zoomOvershootRatio).toBe(1.15);
    expect(result.current.edgePaddingPx).toBe(8);
  });

  it('toggles reduced motion and disables transition CSS', () => {
    const { result } = renderHook(() => usePanelPacing());

    expect(result.current.isMotionReduced).toBe(false);
    act(() => {
      result.current.toggleMotionReduced();
    });
    expect(result.current.isMotionReduced).toBe(true);
    expect(result.current.transitionCss).toBe('none');
    expect(result.current.isOvershootActive).toBe(false);
  });

  it('toggles HUD on "p" and "P" keydown events', () => {
    const { result } = renderHook(() => usePanelPacing());

    expect(result.current.isHUDVisible).toBe(false);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p' }));
    });
    expect(result.current.isHUDVisible).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'P' }));
    });
    expect(result.current.isHUDVisible).toBe(false);
  });

  it('returns bypass values when disabled', () => {
    const { result } = renderHook(() => usePanelPacing());

    act(() => {
      result.current.setIsEnabled(false);
    });

    expect(result.current.transformCss).toBe('none');
    expect(result.current.transitionCss).toBe('none');
    expect(result.current.scale).toBe(1.0);
  });
});
