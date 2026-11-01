import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAutoScroll } from '../../src/hooks/useAutoScroll';

describe('useAutoScroll Hook', () => {
  beforeEach(() => {
    vi.stubGlobal('scrollBy', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with inactive state and default speed', () => {
    const { result } = renderHook(() => useAutoScroll({ speed: 45 }));
    expect(result.current.isActive).toBe(false);
    expect(result.current.speed).toBe(45);
  });

  it('starts, stops, and toggles auto-scroll state correctly', () => {
    const { result } = renderHook(() => useAutoScroll({ speed: 50 }));

    act(() => {
      result.current.start();
    });
    expect(result.current.isActive).toBe(true);

    act(() => {
      result.current.stop();
    });
    expect(result.current.isActive).toBe(false);

    act(() => {
      result.current.toggle();
    });
    expect(result.current.isActive).toBe(true);
  });

  it('clamps speed adjustments between minimum and maximum bounds', () => {
    const { result } = renderHook(() => useAutoScroll({ speed: 50 }));

    act(() => {
      result.current.setSpeed(500); // Exceeds 300 max
    });
    expect(result.current.speed).toBe(300);

    act(() => {
      result.current.setSpeed(2); // Below 10 min
    });
    expect(result.current.speed).toBe(10);
  });
});
