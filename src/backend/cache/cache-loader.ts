import { ByteLRU } from './byte-lru.js';

export interface LoaderResult<T> {
  value: T;
  size: number;
}

export class CacheLoader<T> {
  private readonly cache: ByteLRU<T>;
  private readonly pending = new Map<string, Promise<T | undefined>>();

  constructor(cache: ByteLRU<T>) {
    this.cache = cache;
  }

  async getOrLoad(
    key: string,
    loader: () => Promise<LoaderResult<T> | null | undefined>
  ): Promise<T | undefined> {
    const cached = this.cache.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const inflight = this.pending.get(key);
    if (inflight) {
      return inflight;
    }

    const promise = (async () => {
      try {
        const result = await loader();
        if (result && result.value !== undefined) {
          this.cache.set(key, result.value, result.size);
        }
        return result?.value;
      } finally {
        this.pending.delete(key);
      }
    })();

    this.pending.set(key, promise);
    return promise;
  }
}
