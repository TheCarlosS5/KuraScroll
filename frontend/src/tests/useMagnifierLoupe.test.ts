import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMagnifierLoupe } from '../reader/useMagnifierLoupe';

describe('Sprint 78 - useMagnifierLoupe Hook Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default options', () => {
    const { result } = renderHook(() =>
      useMagnifierLoupe({ enableKeyboard: false })
    );

    expect(result.current.isOpen).toBe(false);
    expect(result.current.isEnabled).toBe(true);
    expect(result.current.shape).toBe('circle');
    expect(result.current.zoomFactor).toBe(2.0);
    expect(result.current.lensRadiusPx).toBe(120);
    expect(result.current.smoothingFactor).toBe(0.15);
    expect(result.current.borderColor).toBe('#3b82f6');
  });

  it('controls HUD visibility correctly', () => {
    const { result } = renderHook(() =>
      useMagnifierLoupe({ enableKeyboard: false })
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

  it('updates shape, zoom factor, and lens radius with proper clamping', () => {
    const { result } = renderHook(() =>
      useMagnifierLoupe({ enableKeyboard: false })
    );

    act(() => {
      result.current.setShape('rectangle');
    });
    expect(result.current.shape).toBe('rectangle');

    act(() => {
      result.current.setZoomFactor(3.5);
    });
    expect(result.current.zoomFactor).toBe(3.5);

    // Clamping checks
    act(() => {
      result.current.setZoomFactor(10.0);
    });
    expect(result.current.zoomFactor).toBe(4.0);

    act(() => {
      result.current.setLensRadiusPx(300);
    });
    expect(result.current.lensRadiusPx).toBe(250);
  });

  it('updates cursor position', () => {
    const { result } = renderHook(() =>
      useMagnifierLoupe({ enableKeyboard: false })
    );

    expect(result.current.cursorPos).toBeNull();

    act(() => {
      result.current.updateCursorPos(350, 420);
    });

    expect(result.current.cursorPos).toEqual({ x: 350, y: 420 });
  });

  it('resets to defaults cleanly', () => {
    const { result } = renderHook(() =>
      useMagnifierLoupe({ enableKeyboard: false })
    );

    act(() => {
      result.current.setShape('rectangle');
      result.current.setZoomFactor(3.5);
      result.current.setLensRadiusPx(200);
      result.current.toggleEnabled();
    });

    expect(result.current.isEnabled).toBe(false);

    act(() => {
      result.current.resetToDefaults();
    });

    expect(result.current.isEnabled).toBe(true);
    expect(result.current.shape).toBe('circle');
    expect(result.current.zoomFactor).toBe(2.0);
  });

  it('responds to keyboard shortcut Z to toggle HUD', () => {
    const { result } = renderHook(() =>
      useMagnifierLoupe({ enableKeyboard: true })
    );

    expect(result.current.isOpen).toBe(false);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z' }));
    });
    expect(result.current.isOpen).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Z' }));
    });
    expect(result.current.isOpen).toBe(false);
  });
});
