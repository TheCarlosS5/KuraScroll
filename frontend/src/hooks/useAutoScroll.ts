import { useState, useEffect, useRef, useCallback } from 'react';

export interface UseAutoScrollOptions {
  speed?: number; // Pixels per second (e.g. 30 to 150)
  pauseOnUserInteraction?: boolean;
  pauseDurationMs?: number; // Duration to pause after manual scroll before resuming
  onReachBottom?: () => void;
}

export interface UseAutoScrollReturn {
  isActive: boolean;
  speed: number;
  toggle: () => void;
  start: () => void;
  stop: () => void;
  setSpeed: (speed: number) => void;
}

/**
 * High-performance requestAnimationFrame auto-scroll hook for Webtoon continuous strips.
 * Provides butter-smooth, frame-rate independent vertical scrolling with auto-pause on user interaction.
 */
export function useAutoScroll(options: UseAutoScrollOptions = {}): UseAutoScrollReturn {
  const {
    speed: initialSpeed = 50,
    pauseOnUserInteraction = true,
    pauseDurationMs = 2500,
    onReachBottom,
  } = options;

  const [isActive, setIsActive] = useState(false);
  const [speed, setSpeedState] = useState(initialSpeed);

  const speedRef = useRef(speed);
  speedRef.current = speed;

  const isPausedByUserRef = useRef(false);
  const pauseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    setIsActive(false);
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (pauseTimeoutRef.current !== null) {
      clearTimeout(pauseTimeoutRef.current);
      pauseTimeoutRef.current = null;
    }
    lastTimeRef.current = null;
    isPausedByUserRef.current = false;
  }, []);

  const start = useCallback(() => {
    setIsActive(true);
    lastTimeRef.current = null;
    isPausedByUserRef.current = false;
  }, []);

  const toggle = useCallback(() => {
    if (isActive) {
      stop();
    } else {
      start();
    }
  }, [isActive, start, stop]);

  const setSpeed = useCallback((newSpeed: number) => {
    const clamped = Math.max(10, Math.min(300, newSpeed));
    setSpeedState(clamped);
  }, []);

  // Handle manual interaction pauses (wheel, touchstart)
  useEffect(() => {
    if (!isActive || !pauseOnUserInteraction) return;

    const handleUserScroll = () => {
      isPausedByUserRef.current = true;
      if (pauseTimeoutRef.current) {
        clearTimeout(pauseTimeoutRef.current);
      }
      pauseTimeoutRef.current = setTimeout(() => {
        isPausedByUserRef.current = false;
        lastTimeRef.current = null; // Reset time delta so there's no jump
      }, pauseDurationMs);
    };

    window.addEventListener('wheel', handleUserScroll, { passive: true });
    window.addEventListener('touchstart', handleUserScroll, { passive: true });
    window.addEventListener('keydown', handleUserScroll, { passive: true });

    return () => {
      window.removeEventListener('wheel', handleUserScroll);
      window.removeEventListener('touchstart', handleUserScroll);
      window.removeEventListener('keydown', handleUserScroll);
      if (pauseTimeoutRef.current) {
        clearTimeout(pauseTimeoutRef.current);
      }
    };
  }, [isActive, pauseOnUserInteraction, pauseDurationMs]);

  // Main animation frame scroll loop
  useEffect(() => {
    if (!isActive) return;

    const step = (timestamp: number) => {
      if (!lastTimeRef.current) {
        lastTimeRef.current = timestamp;
      }
      const deltaMs = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;

      if (!isPausedByUserRef.current && deltaMs > 0 && deltaMs < 200) {
        const scrollDelta = (speedRef.current * deltaMs) / 1000;
        window.scrollBy({ top: scrollDelta, behavior: 'auto' });

        // Check if reached bottom
        const isAtBottom =
          window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 5;
        if (isAtBottom) {
          stop();
          if (onReachBottom) onReachBottom();
          return;
        }
      }

      animationFrameRef.current = requestAnimationFrame(step);
    };

    animationFrameRef.current = requestAnimationFrame(step);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isActive, onReachBottom, stop]);

  return {
    isActive,
    speed,
    toggle,
    start,
    stop,
    setSpeed,
  };
}
