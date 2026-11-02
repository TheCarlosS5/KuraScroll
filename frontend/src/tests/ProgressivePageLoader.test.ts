import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProgressivePageLoader } from '../reader/ProgressivePageLoader.js';

describe('Sprint 57 - ProgressivePageLoader Unit Tests', () => {
  let loader: ProgressivePageLoader;
  let mockCreateObjectURL: any;
  let mockRevokeObjectURL: any;

  beforeEach(() => {
    loader = new ProgressivePageLoader();

    let idCounter = 1;
    mockCreateObjectURL = vi.fn().mockImplementation(() => `blob:http://localhost/blob_${idCounter++}`);
    mockRevokeObjectURL = vi.fn();

    globalThis.URL.createObjectURL = mockCreateObjectURL;
    globalThis.URL.revokeObjectURL = mockRevokeObjectURL;
  });

  afterEach(() => {
    loader.clear();
    vi.restoreAllMocks();
  });

  it('loads a page via fetch and caches the resulting Blob URL', async () => {
    const fakeBlob = new Blob(['fake_image_data'], { type: 'image/webp' });
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      blob: () => Promise.resolve(fakeBlob),
    } as any);

    const url1 = await loader.loadPage('ch_101', 1);
    expect(url1).toBe('blob:http://localhost/blob_1');
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(loader.getCachedUrl('ch_101', 1)).toBe(url1);

    // Second call should hit memory cache without re-fetching
    const url2 = await loader.loadPage('ch_101', 1);
    expect(url2).toBe(url1);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('throws an error if backend returns a non-200 HTTP response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    } as any);

    await expect(loader.loadPage('ch_101', 99)).rejects.toThrowError(
      'Failed to stream page 99: HTTP 404'
    );
  });

  it('aborts prior in-flight request when immediate load is requested for same page', async () => {
    const signals: AbortSignal[] = [];
    globalThis.fetch = vi.fn().mockImplementation((_url, init) => {
      signals.push(init.signal);
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            ok: true,
            status: 200,
            blob: () => Promise.resolve(new Blob(['slow_blob'])),
          });
        }, 100);
      });
    });

    const promise1 = loader.loadPage('ch_101', 5, 'immediate');
    expect(signals[0]?.aborted).toBe(false);

    // Trigger immediate reload
    loader.loadPage('ch_101', 5, 'immediate');
    expect(signals[0]?.aborted).toBe(true);
    expect(signals[1]?.aborted).toBe(false);
  });

  it('supports explicit abortPage and abortAll calls', () => {
    let signal1: AbortSignal | undefined;
    let signal2: AbortSignal | undefined;

    globalThis.fetch = vi.fn()
      .mockImplementationOnce((_url, init) => {
        signal1 = init.signal;
        return new Promise(() => {});
      })
      .mockImplementationOnce((_url, init) => {
        signal2 = init.signal;
        return new Promise(() => {});
      });

    loader.loadPage('ch_101', 1);
    loader.loadPage('ch_101', 2);

    expect(signal1?.aborted).toBe(false);
    expect(signal2?.aborted).toBe(false);

    loader.abortPage('ch_101', 1);
    expect(signal1?.aborted).toBe(true);
    expect(signal2?.aborted).toBe(false);

    loader.abortAll();
    expect(signal2?.aborted).toBe(true);
  });

  it('evicts oldest Blob URL when cache exceeds maxCachedPages (8) to enforce RAM ceiling', async () => {
    globalThis.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        blob: () => Promise.resolve(new Blob(['img'])),
      })
    );

    // Load 8 pages (filling cache)
    for (let p = 1; p <= 8; p++) {
      await loader.loadPage('ch_1', p);
    }
    expect(mockRevokeObjectURL).not.toHaveBeenCalled();

    // Load 9th page (should evict page 1)
    await loader.loadPage('ch_1', 9);
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:http://localhost/blob_1');
    expect(loader.getCachedUrl('ch_1', 1)).toBeNull();
    expect(loader.getCachedUrl('ch_1', 9)).toBe('blob:http://localhost/blob_9');
  });

  it('clear revokes all active blob URLs and empties the cache', async () => {
    globalThis.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        blob: () => Promise.resolve(new Blob(['img'])),
      })
    );

    await loader.loadPage('ch_1', 1);
    await loader.loadPage('ch_1', 2);

    loader.clear();
    expect(mockRevokeObjectURL).toHaveBeenCalledTimes(2);
    expect(loader.getCachedUrl('ch_1', 1)).toBeNull();
    expect(loader.getCachedUrl('ch_1', 2)).toBeNull();
  });
});
