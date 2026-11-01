import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSwipeGestures } from '../../src/hooks/useSwipeGestures';

describe('useSwipeGestures Hook', () => {
  let element: HTMLDivElement;
  let elementRef: { current: HTMLDivElement | null };

  beforeEach(() => {
    element = document.createElement('div');
    document.body.appendChild(element);
    elementRef = { current: element };
  });

  const fireTouch = (type: string, x: number, y: number) => {
    const touch = { clientX: x, clientY: y };
    const event = new Event(type) as any;
    if (type === 'touchstart') {
      event.touches = [touch];
    } else if (type === 'touchend') {
      event.changedTouches = [touch];
    }
    element.dispatchEvent(event);
  };

  it('triggers onSwipeLeft on significant leftward swipe', () => {
    const onSwipeLeft = vi.fn();
    const onSwipeRight = vi.fn();

    renderHook(() =>
      useSwipeGestures(elementRef, {
        onSwipeLeft,
        onSwipeRight,
        minDistance: 40,
        maxPerpendicularDistance: 50,
      })
    );

    fireTouch('touchstart', 200, 100);
    fireTouch('touchend', 100, 105); // DeltaX = -100, DeltaY = 5

    expect(onSwipeLeft).toHaveBeenCalledTimes(1);
    expect(onSwipeRight).not.toHaveBeenCalled();
  });

  it('triggers onSwipeRight on significant rightward swipe', () => {
    const onSwipeLeft = vi.fn();
    const onSwipeRight = vi.fn();

    renderHook(() =>
      useSwipeGestures(elementRef, {
        onSwipeLeft,
        onSwipeRight,
        minDistance: 40,
      })
    );

    fireTouch('touchstart', 100, 100);
    fireTouch('touchend', 220, 110); // DeltaX = +120

    expect(onSwipeRight).toHaveBeenCalledTimes(1);
    expect(onSwipeLeft).not.toHaveBeenCalled();
  });

  it('inverts horizontal callbacks when isRtl is true (Japanese Manga mode)', () => {
    const onSwipeLeft = vi.fn();
    const onSwipeRight = vi.fn();

    renderHook(() =>
      useSwipeGestures(elementRef, {
        onSwipeLeft,
        onSwipeRight,
        minDistance: 40,
        isRtl: true,
      })
    );

    // In RTL, swiping left flips to next page (triggers onSwipeRight)
    fireTouch('touchstart', 200, 100);
    fireTouch('touchend', 100, 100); // DeltaX = -100

    expect(onSwipeRight).toHaveBeenCalledTimes(1);
    expect(onSwipeLeft).not.toHaveBeenCalled();
  });

  it('ignores minor movement below minDistance threshold', () => {
    const onSwipeLeft = vi.fn();

    renderHook(() =>
      useSwipeGestures(elementRef, {
        onSwipeLeft,
        minDistance: 50,
      })
    );

    fireTouch('touchstart', 100, 100);
    fireTouch('touchend', 80, 100); // DeltaX = -20 (< 50)

    expect(onSwipeLeft).not.toHaveBeenCalled();
  });

  it('discards swipe if perpendicular deviation exceeds max threshold', () => {
    const onSwipeLeft = vi.fn();

    renderHook(() =>
      useSwipeGestures(elementRef, {
        onSwipeLeft,
        minDistance: 50,
        maxPerpendicularDistance: 30,
      })
    );

    fireTouch('touchstart', 200, 100);
    fireTouch('touchend', 100, 180); // DeltaX = -100, DeltaY = 80 (> 30)

    expect(onSwipeLeft).not.toHaveBeenCalled();
  });
});
