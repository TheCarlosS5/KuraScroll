import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdaptivePrefetchController } from '../../src/reader/prefetch/AdaptivePrefetchController';

describe('AdaptivePrefetchController (React 19 & HDD Seek Optimization)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default bounds and empty state', () => {
    const controller = new AdaptivePrefetchController({
      maxConcurrent: 2,
      maxCachedBytes: 1024 * 1024,
    });

    expect(controller.getActiveCount()).toBe(0);
    expect(controller.getQueueLength()).toBe(0);
    expect(controller.getCachedBytes()).toBe(0);
  });

  it('queues pages and pumps downloads up to maxConcurrent limit', async () => {
    let fetchCallCount = 0;
    // Mock global fetch
    globalThis.fetch = vi.fn().mockImplementation(async (_url, options) => {
      fetchCallCount++;
      // Check abort signal
      if (options?.signal?.aborted) {
        throw new Error('Aborted');
      }
      return {
        ok: true,
        blob: async () => new Blob(['fake-image-bytes'], { type: 'image/webp' }),
      } as any;
    });

    const controller = new AdaptivePrefetchController({
      maxConcurrent: 2,
      maxCachedBytes: 1024 * 1024,
    });

    controller.setPriority([
      { id: 'p1', url: '/api/v1/chapters/c1/pages/001.webp' },
      { id: 'p2', url: '/api/v1/chapters/c1/pages/002.webp' },
      { id: 'p3', url: '/api/v1/chapters/c1/pages/003.webp' },
    ]);

    // Active requests should immediately be capped at maxConcurrent = 2
    expect(controller.getActiveCount()).toBe(2);
    expect(controller.getQueueLength()).toBe(1);

    // Wait for the active ones to resolve
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(controller.hasBlob('p1')).toBe(true);
    expect(controller.hasBlob('p2')).toBe(true);
    expect(controller.hasBlob('p3')).toBe(true);
    expect(fetchCallCount).toBe(3);
  });

  it('aborts inflight requests for pages that fell out of priority window', async () => {
    const abortSignals: AbortSignal[] = [];

    globalThis.fetch = vi.fn().mockImplementation(async (_url, options) => {
      if (options?.signal) {
        abortSignals.push(options.signal);
      }
      // Simulate long network / HDD delay
      await new Promise((resolve) => setTimeout(resolve, 100));
      return {
        ok: true,
        blob: async () => new Blob(['late-image'], { type: 'image/webp' }),
      } as any;
    });

    const controller = new AdaptivePrefetchController({
      maxConcurrent: 2,
      maxCachedBytes: 1024 * 1024,
    });

    // User is at page 1, priorities: p1, p2
    controller.setPriority([
      { id: 'p1', url: '/pages/001.webp' },
      { id: 'p2', url: '/pages/002.webp' },
    ]);

    expect(controller.getActiveCount()).toBe(2);

    // Fast-scroll: user leaps to page 50! Now priority is p50, p51
    controller.setPriority([
      { id: 'p50', url: '/pages/050.webp' },
      { id: 'p51', url: '/pages/051.webp' },
    ]);

    // Old requests (first 2) should have been aborted!
    expect(abortSignals.length).toBe(4);
    expect(abortSignals[0].aborted).toBe(true); // p1 aborted
    expect(abortSignals[1].aborted).toBe(true); // p2 aborted
    expect(abortSignals[2].aborted).toBe(false); // p50 active
    expect(abortSignals[3].aborted).toBe(false); // p51 active
  });

  it('destroys cleanly and cancels all active tasks and releases blobs', () => {
    const controller = new AdaptivePrefetchController();
    controller.setPriority([{ id: 'p1', url: '/pages/001.webp' }]);

    controller.destroy();
    expect(controller.isDestroyed()).toBe(true);
    expect(controller.getActiveCount()).toBe(0);
    expect(controller.getQueueLength()).toBe(0);
    expect(controller.getCachedBytes()).toBe(0);
  });
});
