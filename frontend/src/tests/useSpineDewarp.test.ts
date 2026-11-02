import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpineDewarp } from '../reader/useSpineDewarp';

describe('Sprint 74 - useSpineDewarp Hook Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default options and generates 16 dewarping slices', () => {
    const { result } = renderHook(() =>
      useSpineDewarp({ enableKeyboard: false })
    );

    expect(result.current.isOpen).toBe(false);
    expect(result.current.isEnabled).toBe(true);
    expect(result.current.gutterSide).toBe('auto');
    expect(result.current.curvatureDepth).toBe(0.25);
    expect(result.current.spineWidthPct).toBe(0.20);
    expect(result.current.shadowCompensation).toBe(0.15);

    expect(result.current.slices).toHaveLength(16);
    expect(result.current.slices[0].scaleX).toBeGreaterThan(1.0);
    expect(result.current.slices[15].scaleX).toBe(1.0);
  });

  it('controls modal open/close/toggle correctly', () => {
    const { result } = renderHook(() =>
      useSpineDewarp({ enableKeyboard: false })
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

  it('disables dewarping and resets slices to identity factor 1.0', () => {
    const { result } = renderHook(() =>
      useSpineDewarp({ enableKeyboard: false })
    );

    expect(result.current.isEnabled).toBe(true);

    act(() => {
      result.current.toggleEnabled();
    });

    expect(result.current.isEnabled).toBe(false);
    for (const slice of result.current.slices) {
      expect(slice.scaleX).toBe(1.0);
      expect(slice.brightness).toBe(1.0);
    }
  });

  it('updates parameter state and resets to defaults', () => {
    const { result } = renderHook(() =>
      useSpineDewarp({ enableKeyboard: false })
    );

    act(() => {
      result.current.setGutterSide('right');
      result.current.setCurvatureDepth(0.40);
      result.current.setSpineWidthPct(0.30);
      result.current.setShadowCompensation(0.25);
    });

    expect(result.current.gutterSide).toBe('right');
    expect(result.current.curvatureDepth).toBe(0.40);
    expect(result.current.spineWidthPct).toBe(0.30);
    expect(result.current.shadowCompensation).toBe(0.25);

    act(() => {
      result.current.resetToDefaults();
    });

    expect(result.current.gutterSide).toBe('auto');
    expect(result.current.curvatureDepth).toBe(0.25);
    expect(result.current.spineWidthPct).toBe(0.20);
    expect(result.current.shadowCompensation).toBe(0.15);
  });

  it('toggles HUD via keyboard shortcut "w" / "W"', () => {
    const { result } = renderHook(() =>
      useSpineDewarp({ enableKeyboard: true })
    );

    expect(result.current.isOpen).toBe(false);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }));
    });
    expect(result.current.isOpen).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'W' }));
    });
    expect(result.current.isOpen).toBe(false);
  });
});
