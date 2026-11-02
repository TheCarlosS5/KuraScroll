/**
 * Sprint 57 - Client-Side Progressive Page Loader & Blob URL LRU Cache
 *
 * Implements strict memory ceiling (< 8 pages in RAM) and AbortController
 * cancellation for rapid page turns on Intel Pentium T4500 (<= 512MB heap).
 */

export interface PageLoadOptions {
  chapterId: string;
  pageNumber: number;
  priority?: 'immediate' | 'background';
}

export class ProgressivePageLoader {
  private activeControllers: Map<string, AbortController> = new Map();
  private blobUrlCache: Map<string, string> = new Map();
  private maxCachedPages: number = 8; // Memory ceiling: ~16-24MB max RAM

  private getKey(chapterId: string, pageNumber: number): string {
    return `${chapterId}_p${pageNumber}`;
  }

  public getCachedUrl(chapterId: string, pageNumber: number): string | null {
    const key = this.getKey(chapterId, pageNumber);
    return this.blobUrlCache.get(key) || null;
  }

  public async loadPage(chapterId: string, pageNumber: number, priority: 'immediate' | 'background' = 'immediate'): Promise<string> {
    const key = this.getKey(chapterId, pageNumber);

    // 1. Cache hit: return already hydrated Blob URL
    const existing = this.blobUrlCache.get(key);
    if (existing) {
      return existing;
    }

    // 2. Cancel prior in-flight request if this is an immediate visible page
    if (priority === 'immediate') {
      const pending = this.activeControllers.get(key);
      if (pending) {
        pending.abort();
      }
    }

    const controller = new AbortController();
    this.activeControllers.set(key, controller);

    try {
      const response = await fetch(`/api/v1/chapters/${chapterId}/pages/${pageNumber}/stream`, {
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Failed to stream page ${pageNumber}: HTTP ${response.status}`);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);

      // LRU eviction to stay strictly under RAM budget
      this.evictIfNeeded();
      this.blobUrlCache.set(key, objectUrl);

      return objectUrl;
    } finally {
      this.activeControllers.delete(key);
    }
  }

  public abortPage(chapterId: string, pageNumber: number): void {
    const key = this.getKey(chapterId, pageNumber);
    const controller = this.activeControllers.get(key);
    if (controller) {
      controller.abort();
      this.activeControllers.delete(key);
    }
  }

  public abortAll(): void {
    for (const controller of this.activeControllers.values()) {
      controller.abort();
    }
    this.activeControllers.clear();
  }

  public clear(): void {
    this.abortAll();
    for (const url of this.blobUrlCache.values()) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // silent
      }
    }
    this.blobUrlCache.clear();
  }

  private evictIfNeeded(): void {
    if (this.blobUrlCache.size >= this.maxCachedPages) {
      const oldestKey = this.blobUrlCache.keys().next().value;
      if (oldestKey) {
        const url = this.blobUrlCache.get(oldestKey);
        if (url) {
          try {
            URL.revokeObjectURL(url);
          } catch {
            // silent
          }
        }
        this.blobUrlCache.delete(oldestKey);
      }
    }
  }
}
