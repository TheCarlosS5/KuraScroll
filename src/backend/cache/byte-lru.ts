export interface ByteLRUOptions<T> {
  maxBytes: number;
  maxEntryBytes?: number;
  onEvict?: (value: T, key: string) => void;
}

export interface ByteLRUMetrics {
  entries: number;
  usedBytes: number;
  maxBytes: number;
  hits: number;
  misses: number;
  evictions: number;
  rejected: number;
  hitRatio: number;
}

interface CacheItem<T> {
  value: T;
  size: number;
}

export class ByteLRU<T = unknown> {
  private readonly maxBytes: number;
  private readonly maxEntryBytes: number;
  private readonly onEvict: (value: T, key: string) => void;
  private bytes = 0;
  private readonly items = new Map<string, CacheItem<T>>();

  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    rejected: 0,
  };

  constructor(options: ByteLRUOptions<T>) {
    this.maxBytes = options.maxBytes;
    this.maxEntryBytes = options.maxEntryBytes ?? options.maxBytes;
    this.onEvict = options.onEvict ?? (() => {});
  }

  get(key: string): T | undefined {
    const item = this.items.get(key);
    if (!item) {
      this.stats.misses++;
      return undefined;
    }

    // Refresh LRU order: delete and re-insert as newest
    this.items.delete(key);
    this.items.set(key, item);
    this.stats.hits++;
    return item.value;
  }

  has(key: string): boolean {
    return this.items.has(key);
  }

  set(key: string, value: T, size: number): boolean {
    if (!Number.isSafeInteger(size) || size < 0 || size > this.maxEntryBytes) {
      this.stats.rejected++;
      return false;
    }

    // Remove existing if present to adjust size
    this.delete(key);

    // Evict oldest items if exceeding capacity
    while (this.bytes + size > this.maxBytes && this.items.size > 0) {
      const oldestKey = this.items.keys().next().value;
      if (!oldestKey) break;
      this.delete(oldestKey);
      this.stats.evictions++;
    }

    this.items.set(key, { value, size });
    this.bytes += size;
    return true;
  }

  delete(key: string): boolean {
    const item = this.items.get(key);
    if (!item) return false;

    this.items.delete(key);
    this.bytes -= item.size;

    try {
      this.onEvict(item.value, key);
    } catch {
      // Eviction callback errors must not corrupt cache state
    }

    return true;
  }

  clear(): void {
    for (const key of Array.from(this.items.keys())) {
      this.delete(key);
    }
  }

  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      rejected: 0,
    };
  }

  getMetrics(): ByteLRUMetrics {
    const totalRequests = this.stats.hits + this.stats.misses;
    return {
      entries: this.items.size,
      usedBytes: this.bytes,
      maxBytes: this.maxBytes,
      ...this.stats,
      hitRatio: totalRequests > 0 ? this.stats.hits / totalRequests : 0,
    };
  }
}
