import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AdaptivePrefetchEngine } from '../../src/reader/AdaptivePrefetchEngine';
import { networkStatusService } from '../../src/services/network-status-service';

describe('AdaptivePrefetchEngine (Sprint 38)', () => {
  let engine: AdaptivePrefetchEngine;

  beforeEach(() => {
    vi.useFakeTimers();
    engine = new AdaptivePrefetchEngine(50); // Fast 50ms debounce for testing

    networkStatusService._overrideStatus({
      online: true,
      saveData: false,
      effectiveType: '4g',
      tier: 'high',
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url, init) => {
        if (init?.signal?.aborted) {
          const err = new Error('Aborted');
          err.name = 'AbortError';
          return Promise.reject(err);
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          blob: () => Promise.resolve(new Blob(['fake-image'], { type: 'image/webp' })),
        });
      })
    );
  });

  afterEach(() => {
    engine.dispose();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Dynamic Window Calculation', () => {
    it('calculates 4 pages forward for fast reader (velocity <= 3.0s)', () => {
      const windowSize = engine.calculateForwardWindow(2.5, 'high', false);
      expect(windowSize).toBe(4);
    });

    it('calculates 2 pages forward for moderate reader (velocity = 6.0s)', () => {
      const windowSize = engine.calculateForwardWindow(6.0, 'high', false);
      expect(windowSize).toBe(2);
    });

    it('calculates 1 page forward for deep reader (velocity = 15.0s)', () => {
      const windowSize = engine.calculateForwardWindow(15.0, 'high', false);
      expect(windowSize).toBe(1);
    });

    it('clamps to 1 page forward when saveData is enabled or tier is low', () => {
      expect(engine.calculateForwardWindow(2.0, 'low', false)).toBe(1);
      expect(engine.calculateForwardWindow(2.0, 'high', true)).toBe(1);
    });

    it('clamps to at most 2 pages when tier is balanced', () => {
      expect(engine.calculateForwardWindow(2.0, 'balanced', false)).toBe(2);
    });
  });

  describe('Debounce & Scrubbing Cancellation', () => {
    it('debounces rapid page scrubbing and only prefetches for final resting position', async () => {
      const pages = ['p1.webp', 'p2.webp', 'p3.webp', 'p4.webp', 'p5.webp', 'p6.webp', 'p7.webp', 'p8.webp'];

      // User rapidly scrubs 0 -> 1 -> 2 -> 5 within 20ms
      engine.updatePosition('c1', 0, pages.length, pages, 3.0);
      vi.advanceTimersByTime(10);
      engine.updatePosition('c1', 1, pages.length, pages, 3.0);
      vi.advanceTimersByTime(10);
      engine.updatePosition('c1', 5, pages.length, pages, 3.0);

      // Advance debounce timer (50ms)
      await vi.advanceTimersByTimeAsync(60);

      const fetchMock = global.fetch as any;
      expect(fetchMock).toHaveBeenCalled();

      // Pages around index 5 (forward: 6, 7, backward: 4) should be fetched with X-Purpose: prefetch
      const calledUrls = fetchMock.mock.calls.map((c: any) => c[0]);
      expect(calledUrls.some((u: string) => u.includes('p7.webp'))).toBe(true);
      expect(calledUrls.some((u: string) => u.includes('p6.webp'))).toBe(false); // Current page (index 5 = p6.webp) isn't prefetched
    });

    it('sends X-Purpose: prefetch header on all speculative requests', async () => {
      const pages = ['p1.webp', 'p2.webp', 'p3.webp'];
      engine.updatePosition('c1', 0, pages.length, pages, 8.0);

      await vi.advanceTimersByTimeAsync(60);

      const fetchMock = global.fetch as any;
      expect(fetchMock).toHaveBeenCalled();
      const headers = fetchMock.mock.calls[0][1]?.headers;
      expect(headers['X-Purpose']).toBe('prefetch');
    });

    it('recovers gracefully and silently when prefetch returns 404 or network error', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(() => {
          return Promise.resolve({
            ok: false,
            status: 404,
          });
        })
      );

      const pages = ['p1.webp', 'p2.webp'];
      engine.updatePosition('c1', 0, pages.length, pages, 8.0);

      // Should complete without throwing unhandled exceptions
      await expect(vi.advanceTimersByTimeAsync(60)).resolves.not.toThrow();
    });
  });

  describe('Telemetry Reporting', () => {
    it('reports accurate telemetry on prefetch state', () => {
      const telemetry = engine.getTelemetry();
      expect(telemetry.isPrefetching).toBe(false);
      expect(telemetry.prefetchedCount).toBe(0);
      expect(telemetry.currentTier).toBe('high');
      expect(telemetry.windowForward).toBeGreaterThanOrEqual(1);
    });
  });
});
