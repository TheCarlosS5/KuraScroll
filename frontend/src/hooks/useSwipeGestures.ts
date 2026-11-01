import { useEffect, useRef, useCallback } from 'react';

export interface UseSwipeGesturesOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  minDistance?: number; // Minimum distance in pixels to qualify as swipe (default 50px)
  maxPerpendicularDistance?: number; // Max perpendicular deviation before invalidating (default 80px)
  isRtl?: boolean; // When true, swaps left and right swipe callbacks for RTL manga
  enabled?: boolean;
}

export function useSwipeGestures(
  elementRef: React.RefObject<HTMLElement | null>,
  options: UseSwipeGesturesOptions
) {
  const {
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    minDistance = 50,
    maxPerpendicularDistance = 80,
    isRtl = false,
    enabled = true,
  } = options;

  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (!enabled || e.touches.length !== 1) return;
      startXRef.current = e.touches[0].clientX;
      startYRef.current = e.touches[0].clientY;
    },
    [enabled]
  );

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (!enabled || startXRef.current === null || startYRef.current === null) return;

      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;

      const deltaX = endX - startXRef.current;
      const deltaY = endY - startYRef.current;

      const absDeltaX = Math.abs(deltaX);
      const absDeltaY = Math.abs(deltaY);

      startXRef.current = null;
      startYRef.current = null;

      // Horizontal swipe detection
      if (absDeltaX >= minDistance && absDeltaY <= maxPerpendicularDistance) {
        if (deltaX < 0) {
          // Swiped Left
          if (isRtl) {
            if (onSwipeRight) onSwipeRight();
          } else {
            if (onSwipeLeft) onSwipeLeft();
          }
        } else {
          // Swiped Right
          if (isRtl) {
            if (onSwipeLeft) onSwipeLeft();
          } else {
            if (onSwipeRight) onSwipeRight();
          }
        }
        return;
      }

      // Vertical swipe detection
      if (absDeltaY >= minDistance && absDeltaX <= maxPerpendicularDistance) {
        if (deltaY < 0) {
          if (onSwipeUp) onSwipeUp();
        } else {
          if (onSwipeDown) onSwipeDown();
        }
      }
    },
    [enabled, minDistance, maxPerpendicularDistance, isRtl, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown]
  );

  useEffect(() => {
    const el = elementRef.current || (typeof window !== 'undefined' ? window : null);
    if (!el || !enabled) return;

    el.addEventListener('touchstart', handleTouchStart as any, { passive: true });
    el.addEventListener('touchend', handleTouchEnd as any, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart as any);
      el.removeEventListener('touchend', handleTouchEnd as any);
    };
  }, [elementRef, enabled, handleTouchStart, handleTouchEnd]);
}
