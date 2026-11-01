export interface PagePrefetchTarget {
  id: string;
  url: string;
}

export interface AdaptivePrefetchOptions {
  maxConcurrent?: number;
  maxCachedBytes?: number;
  maxBlobBytes?: number;
}

interface QueuedPage extends PagePrefetchTarget {
  priority: number;
  sequence: number;
}

interface ActiveTask {
  controller: AbortController;
  priority: number;
}

export class AdaptivePrefetchController {
  private readonly maxConcurrent: number;
  private readonly maxCachedBytes: number;
  private readonly maxBlobBytes: number;

  private queue: QueuedPage[] = [];
  private readonly active = new Map<string, ActiveTask>();
  private readonly blobs = new Map<string, Blob>();

  private cachedBytes = 0;
  private sequence = 0;
  private destroyed = false;

  constructor(options: AdaptivePrefetchOptions = {}) {
    this.maxConcurrent = options.maxConcurrent ?? 2;
    this.maxCachedBytes = options.maxCachedBytes ?? 32 * 1024 * 1024;
    this.maxBlobBytes = options.maxBlobBytes ?? 8 * 1024 * 1024;
  }

  setPriority(pages: PagePrefetchTarget[]): void {
    if (this.destroyed) return;

    const wanted = new Map<string, PagePrefetchTarget & { priority: number }>(
      pages.map((page, index) => [
        page.id,
        {
          ...page,
          priority: pages.length - index,
        },
      ])
    );

    // Cancel active requests that are no longer in the priority window
    for (const [id, task] of Array.from(this.active.entries())) {
      if (!wanted.has(id)) {
        task.controller.abort();
        this.active.delete(id);
      }
    }

    // Filter queue to retain only relevant pages
    this.queue = this.queue.filter(
      (page) => wanted.has(page.id) && !this.blobs.has(page.id) && !this.active.has(page.id)
    );

    // Enqueue newly wanted pages
    for (const page of wanted.values()) {
      if (this.blobs.has(page.id) || this.active.has(page.id)) {
        continue;
      }

      this.queue.push({
        ...page,
        sequence: ++this.sequence,
      });
    }

    // Sort queue by priority descending, then sequence ascending
    this.queue.sort((a, b) => b.priority - a.priority || a.sequence - b.sequence);

    this.pump();
  }

  private pump(): void {
    if (this.destroyed) return;

    while (this.active.size < this.maxConcurrent && this.queue.length > 0) {
      const page = this.queue.shift();
      if (!page) break;

      const controller = new AbortController();
      const task: ActiveTask = {
        controller,
        priority: page.priority,
      };

      this.active.set(page.id, task);

      this.fetchPage(page, controller.signal)
        .catch(() => {})
        .finally(() => {
          if (this.active.get(page.id) === task) {
            this.active.delete(page.id);
          }
          this.pump();
        });
    }
  }

  private async fetchPage(page: PagePrefetchTarget, signal: AbortSignal): Promise<void> {
    const response = await fetch(page.url, {
      signal,
      cache: 'force-cache',
    });

    if (!response.ok) {
      throw new Error(`Prefetch failed with status ${response.status}`);
    }

    const blob = await response.blob();
    if (signal.aborted || this.destroyed) return;
    if (blob.size === 0 || blob.size > this.maxBlobBytes) return;

    this.insertBlob(page.id, blob);
  }

  private insertBlob(id: string, blob: Blob): void {
    if (this.blobs.has(id)) return;

    while (this.cachedBytes + blob.size > this.maxCachedBytes && this.blobs.size > 0) {
      const oldestKey = this.blobs.keys().next().value;
      if (!oldestKey) break;

      const oldest = this.blobs.get(oldestKey);
      if (oldest) {
        this.blobs.delete(oldestKey);
        this.cachedBytes -= oldest.size;
      }
    }

    this.blobs.set(id, blob);
    this.cachedBytes += blob.size;
  }

  hasBlob(id: string): boolean {
    return this.blobs.has(id);
  }

  getBlob(id: string): Blob | undefined {
    const blob = this.blobs.get(id);
    if (!blob) return undefined;

    // Refresh LRU order
    this.blobs.delete(id);
    this.blobs.set(id, blob);
    return blob;
  }

  getActiveCount(): number {
    return this.active.size;
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  getCachedBytes(): number {
    return this.cachedBytes;
  }

  isDestroyed(): boolean {
    return this.destroyed;
  }

  cancelAll(): void {
    for (const task of this.active.values()) {
      task.controller.abort();
    }
    this.active.clear();
    this.queue = [];
  }

  destroy(): void {
    this.destroyed = true;
    this.cancelAll();
    this.blobs.clear();
    this.cachedBytes = 0;
  }
}
