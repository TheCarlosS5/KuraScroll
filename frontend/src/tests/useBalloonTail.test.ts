import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useBalloonTail,
  localCalculateBalloonTail,
} from '../reader/useBalloonTail';

describe('useBalloonTail Hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default manga_compact preset and closed HUD', () => {
    const { result } = renderHook(() => useBalloonTail('test-series-tail'));

    expect(result.current.isHUDOpen).toBe(false);
    expect(result.current.tailStyle).toBe('manga_compact');
    expect(result.current.balloonShape).toBe('ellipse');
    expect(result.current.rootWidthPx).toBe(14.0);
    expect(result.current.curvatureFactor).toBe(0.15);
    expect(result.current.isEnabled).toBe(true);
    expect(result.current.currentResult.svgPathD).toContain('M ');
  });

  it('toggles HUD on keyboard key T / t', () => {
    const { result } = renderHook(() => useBalloonTail('test-series-tail'));

    expect(result.current.isHUDOpen).toBe(false);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 't' }));
    });
    expect(result.current.isHUDOpen).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'T' }));
    });
    expect(result.current.isHUDOpen).toBe(false);
  });

  it('switches tail presets and updates geometry', () => {
    const { result } = renderHook(() => useBalloonTail('test-series-tail'));

    act(() => {
      result.current.selectPreset('manhwa_clean');
    });
    expect(result.current.tailStyle).toBe('manhwa_clean');
    expect(result.current.balloonShape).toBe('rounded_rect');
    expect(result.current.rootWidthPx).toBe(14.0);
    expect(result.current.curvatureFactor).toBe(0.12);

    act(() => {
      result.current.selectPreset('shout_dynamic');
    });
    expect(result.current.tailStyle).toBe('shout_dynamic');
    expect(result.current.balloonShape).toBe('polygon_shout');
    expect(result.current.rootWidthPx).toBe(24.0);
  });

  it('evaluates localCalculateBalloonTail correctly with zero allocation', () => {
    const res = localCalculateBalloonTail(100, 100, 60, 40, 200, 250, 'manga_compact', 'ellipse', 12.0, 0.1, 4.0, true);
    expect(res.tailStyle).toBe('manga_compact');
    expect(res.svgPathD).toContain('M ');
    expect(res.svgPathD).toContain('Q ');
    expect(res.lengthPx).toBeGreaterThan(0);
  });
});
