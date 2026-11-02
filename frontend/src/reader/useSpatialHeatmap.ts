/**
 * Sprint 61 - Client-Side Spatial Reading Heatmap Hook
 *
 * Provides reactive 16x16 spatial attention tracking, automatic gaze/dwell accumulation,
 * write-behind flushing, and keyboard toggle ('H') for Canvas 2D overlay.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export interface UseSpatialHeatmapOptions {
  chapterId: string;
  pageNumber: number;
  userId?: string;
  autoRecord?: boolean;
  sampleIntervalMs?: number; // default 1000ms
  initialVisible?: boolean;
  initialOpacity?: number; // 0.1 to 0.8
  apiBaseUrl?: string;
}

export interface UseSpatialHeatmapReturn {
  isVisible: boolean;
  toggleVisibility: () => void;
  setIsVisible: (v: boolean) => void;
  opacity: number;
  setOpacity: (o: number) => void;
  matrix2D: number[][]; // 16x16 normalized values 0.0 .. 1.0
  totalDwellMs: number;
  peakIntensity: number;
  isLoading: boolean;
  error: string | null;
  recordFocusPoint: (x: number, y: number, dwellMs?: number) => void;
  recordFocusBox: (
    box: { x: number; y: number; w: number; h: number },
    dwellMs?: number,
    focusType?: 'BUBBLE' | 'PANEL'
  ) => void;
  flush: () => Promise<void>;
  refresh: () => Promise<void>;
}

// Generate an empty 16x16 matrix
function createEmptyMatrix(): number[][] {
  const m: number[][] = [];
  for (let r = 0; r < 16; r++) {
    m.push(new Array(16).fill(0));
  }
  return m;
}

export function useSpatialHeatmap(options: UseSpatialHeatmapOptions): UseSpatialHeatmapReturn {
  const {
    chapterId,
    pageNumber,
    userId = 'local-reader',
    autoRecord = true,
    sampleIntervalMs = 2000,
    initialVisible = false,
    initialOpacity = 0.55,
    apiBaseUrl = '',
  } = options;

  const [isVisible, setIsVisible] = useState(initialVisible);
  const [opacity, setOpacity] = useState(initialOpacity);
  const [matrix2D, setMatrix2D] = useState<number[][]>(createEmptyMatrix);
  const [totalDwellMs, setTotalDwellMs] = useState(0);
  const [peakIntensity, setPeakIntensity] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dwellStartRef = useRef<number>(Date.now());
  const pendingDwellMsRef = useRef<number>(0);
  const autoRecordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keyboard shortcut: 'H' toggles heatmap overlay
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is in an input field
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        setIsVisible((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleVisibility = useCallback(() => {
    setIsVisible((prev) => !prev);
  }, []);

  // Fetch heatmap from backend
  const fetchHeatmap = useCallback(async () => {
    if (!chapterId || pageNumber < 1) return;
    setIsLoading(true);
    setError(null);

    try {
      const url = `${apiBaseUrl}/api/v1/analytics/spatial-heatmap/page?chapterId=${encodeURIComponent(
        chapterId
      )}&pageNumber=${pageNumber}&userId=${encodeURIComponent(userId)}`;

      const res = await fetch(url);
      if (res.status === 404) {
        // No heatmap recorded yet, default to zeros
        setMatrix2D(createEmptyMatrix());
        setTotalDwellMs(0);
        setPeakIntensity(0);
        return;
      }

      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}`);
      }

      const json = await res.json();
      if (json.heatmap) {
        setMatrix2D(json.heatmap.matrix2D ?? createEmptyMatrix());
        setTotalDwellMs(json.heatmap.totalDwellMs ?? 0);
        setPeakIntensity(json.heatmap.peakIntensity ?? 0);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch spatial heatmap');
    } finally {
      setIsLoading(false);
    }
  }, [chapterId, pageNumber, userId, apiBaseUrl]);

  // Initial fetch when page changes
  useEffect(() => {
    fetchHeatmap();
    dwellStartRef.current = Date.now();
    pendingDwellMsRef.current = 0;
  }, [fetchHeatmap]);

  // Flush pending dwell
  const flush = useCallback(async () => {
    if (pendingDwellMsRef.current > 0) {
      const dwellToFlush = pendingDwellMsRef.current;
      pendingDwellMsRef.current = 0;

      try {
        await fetch(`${apiBaseUrl}/api/v1/analytics/spatial-heatmap/record`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chapterId,
            pageNumber,
            userId,
            dwellMs: dwellToFlush,
            focusType: 'GLOBAL',
          }),
        });
      } catch {
        // Ignore background reporting error
      }
    }

    try {
      await fetch(`${apiBaseUrl}/api/v1/analytics/spatial-heatmap/flush`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapterId, userId }),
      });
    } catch {
      // Ignore background reporting error
    }
  }, [apiBaseUrl, chapterId, pageNumber, userId]);

  // Periodic auto-recorder while user is on this page
  useEffect(() => {
    if (!autoRecord || !chapterId || pageNumber < 1) return;

    autoRecordTimerRef.current = setInterval(() => {
      const now = Date.now();
      const delta = now - dwellStartRef.current;
      dwellStartRef.current = now;

      if (delta > 0 && delta < sampleIntervalMs * 3) {
        pendingDwellMsRef.current += delta;

        // Dispatch background update
        fetch(`${apiBaseUrl}/api/v1/analytics/spatial-heatmap/record`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chapterId,
            pageNumber,
            userId,
            dwellMs: delta,
            focusType: 'GLOBAL',
          }),
        }).catch(() => {});
      }
    }, sampleIntervalMs);

    return () => {
      if (autoRecordTimerRef.current) {
        clearInterval(autoRecordTimerRef.current);
      }
      flush();
    };
  }, [autoRecord, chapterId, pageNumber, userId, sampleIntervalMs, apiBaseUrl, flush]);

  // Record point focus (e.g. mouse hover or tap)
  const recordFocusPoint = useCallback(
    (x: number, y: number, dwellMs = 300) => {
      fetch(`${apiBaseUrl}/api/v1/analytics/spatial-heatmap/record`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chapterId,
          pageNumber,
          userId,
          dwellMs,
          focusType: 'KINETIC_POINT',
          point: { x, y },
        }),
      }).catch(() => {});
    },
    [apiBaseUrl, chapterId, pageNumber, userId]
  );

  // Record box focus (e.g. speech bubble or panel dwell)
  const recordFocusBox = useCallback(
    (
      box: { x: number; y: number; w: number; h: number },
      dwellMs = 500,
      focusType: 'BUBBLE' | 'PANEL' = 'BUBBLE'
    ) => {
      fetch(`${apiBaseUrl}/api/v1/analytics/spatial-heatmap/record`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chapterId,
          pageNumber,
          userId,
          dwellMs,
          focusType,
          boundingBox: box,
        }),
      }).catch(() => {});
    },
    [apiBaseUrl, chapterId, pageNumber, userId]
  );

  return {
    isVisible,
    toggleVisibility,
    setIsVisible,
    opacity,
    setOpacity,
    matrix2D,
    totalDwellMs,
    peakIntensity,
    isLoading,
    error,
    recordFocusPoint,
    recordFocusBox,
    flush,
    refresh: fetchHeatmap,
  };
}
