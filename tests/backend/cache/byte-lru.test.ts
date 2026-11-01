import { describe, it, expect, vi } from 'vitest';
import { ByteLRU } from '../../../src/backend/cache/byte-lru.js';
import { CacheLoader } from '../../../src/backend/cache/cache-loader.js';

describe('ByteLRU Memory Cache & Singleflight Loader', () => {
  it('stores and retrieves items, tracking hits and misses', () => {
    const lru = new ByteLRU<string>({ maxBytes: 100 });
    lru.set('k1', 'val1', 20);

    expect(lru.get('k1')).toBe('val1');
    expect(lru.get('nonexistent')).toBeUndefined();

    const metrics = lru.getMetrics();
    expect(metrics.hits).toBe(1);
    expect(metrics.misses).toBe(1);
    expect(metrics.usedBytes).toBe(20);
    expect(metrics.entries).toBe(1);
  });

  it('evicts oldest items when exceeding maxBytes in strict LRU order', () => {
    const evicted: Array<{ key: string; value: string }> = [];
    const lru = new ByteLRU<string>({
      maxBytes: 50,
      onEvict: (val, key) => evicted.push({ key, value: val }),
    });

    lru.set('a', 'alpha', 20); // total: 20
    lru.set('b', 'beta', 20);  // total: 40

    // Touch 'a' to make 'b' the oldest
    expect(lru.get('a')).toBe('alpha');

    // Add 'c' with 20 bytes -> total would be 60 > 50, must evict 'b'
    lru.set('c', 'gamma', 20);

    expect(lru.has('b')).toBe(false);
    expect(lru.has('a')).toBe(true);
    expect(lru.has('c')).toBe(true);
    expect(lru.getMetrics().usedBytes).toBe(40);
    expect(lru.getMetrics().evictions).toBe(1);
    expect(evicted).toEqual([{ key: 'b', value: 'beta' }]);
  });

  it('rejects entries that exceed maxEntryBytes', () => {
    const lru = new ByteLRU<string>({
      maxBytes: 100,
      maxEntryBytes: 30,
    });

    const success = lru.set('huge', 'payload', 50);
    expect(success).toBe(false);
    expect(lru.has('huge')).toBe(false);
    expect(lru.getMetrics().rejected).toBe(1);
  });

  it('re-inserting an existing key updates its size and moves to newest', () => {
    const lru = new ByteLRU<string>({ maxBytes: 50 });
    lru.set('a', 'first', 10);
    lru.set('a', 'second', 25);

    expect(lru.get('a')).toBe('second');
    expect(lru.getMetrics().usedBytes).toBe(25);
    expect(lru.getMetrics().entries).toBe(1);
  });

  it('CacheLoader deduplicates concurrent requests for the identical key (Singleflight)', async () => {
    const lru = new ByteLRU<Buffer>({ maxBytes: 1024 * 1024 });
    const loader = new CacheLoader(lru);

    const diskReaderMock = vi.fn(async () => {
      // Simulate 20ms mechanical disk seek
      await new Promise((resolve) => setTimeout(resolve, 20));
      return { value: Buffer.from('page-image-bytes'), size: 16 };
    });

    // 10 concurrent requests arrive for the exact same chapter page
    const requests = Array.from({ length: 10 }, () =>
      loader.getOrLoad('chapter-1/page-1', diskReaderMock)
    );

    const results = await Promise.all(requests);

    // All 10 requests receive identical buffer
    for (const res of results) {
      expect(res?.toString()).toBe('page-image-bytes');
    }

    // Disk was only accessed once!
    expect(diskReaderMock).toHaveBeenCalledTimes(1);
    expect(lru.has('chapter-1/page-1')).toBe(true);
  });
});
