import { networkStatusService, AssetTier } from '../services/network-status-service';

export interface PrefetchTelemetry {
  isPrefetching: boolean;
  prefetchedCount: number;
  lastRequestedIndex: number | null;
  currentTier: AssetTier;
  windowForward: number;
  windowBackward: number;
}

export class AdaptivePrefetchEngine {
  private activeAbortController: AbortController | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private prefetchedUrls: Set<string> = new Set();
  private maxCachedUrls = 60;
  private isPrefetching = false;
  private lastRequestedIndex: number | null = null;
  private windowForward = 2;
  private windowBackward = 1;

  constructor(private debounceMs = 300) {}

  /**
   * Calculates the dynamic forward window according to reading speed (EMA) and network constraints.
   * Faster readers (vEMA <= 4s) get up to 4 pages.
   * Deep readers (vEMA >= 12s) get 1 page.
   * Low bandwidth / Save-Data caps the window to 1 page to prevent SATA II HDD thrashing.
   */
  public calculateForwardWindow(
    emaVelocitySecondsPerPage = 8.0,
    tier: AssetTier = 'high',
    isSaveData = false
  ): number {
    if (isSaveData) return 1;

    const safeVelocity = Math.max(1.5, Math.min(300.0, emaVelocitySecondsPerPage));
    const rawWindow = Math.ceil(12.0 / safeVelocity);
    let clamped = Math.max(1, Math.min(4, rawWindow));

    if (tier === 'low') {
      clamped = 1;
    } else if (tier === 'balanced') {
      clamped = Math.min(clamped, 2);
    }

    return clamped;
  }

  /**
   * Updates current reading position, canceling prior pending requests and debouncing the prefetch cycle.
   */
  public updatePosition(
    chapterId: string,
    currentPageIndex: number,
    totalPages: number,
    pageFileNames: string[],
    emaVelocitySecondsPerPage = 8.0,
    mobilePrefetchAllowed = true
  ): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (this.activeAbortController) {
      this.activeAbortController.abort();
      this.activeAbortController = null;
      this.isPrefetching = false;
    }

    const netStatus = networkStatusService.getNetworkStatus();
    if (!networkStatusService.shouldPrefetch(mobilePrefetchAllowed)) {
      this.isPrefetching = false;
      return;
    }

    this.windowForward = this.calculateForwardWindow(
      emaVelocitySecondsPerPage,
      netStatus.tier,
      netStatus.saveData
    );
    this.windowBackward = 1;

    this.debounceTimer = setTimeout(() => {
      this.executePrefetch(chapterId, currentPageIndex, totalPages, pageFileNames, netStatus.tier);
    }, this.debounceMs);
  }

  private async executePrefetch(
    chapterId: string,
    currentPageIndex: number,
    totalPages: number,
    pageFileNames: string[],
    tier: AssetTier
  ): Promise<void> {
    const targetIndices: number[] = [];

    // Forward prefetch
    for (let offset = 1; offset <= this.windowForward; offset++) {
      const idx = currentPageIndex + offset;
      if (idx < totalPages) {
        targetIndices.push(idx);
      }
    }

    // Backward prefetch (1 page)
    const prevIdx = currentPageIndex - 1;
    if (prevIdx >= 0) {
      targetIndices.push(prevIdx);
    }

    if (targetIndices.length === 0) {
      this.isPrefetching = false;
      return;
    }

    const controller = new AbortController();
    this.activeAbortController = controller;
    this.isPrefetching = true;

    for (const idx of targetIndices) {
      if (controller.signal.aborted) break;

      const fileName = pageFileNames[idx];
      if (!fileName) continue;

      const url = `/api/v1/chapters/${encodeURIComponent(chapterId)}/pages/${encodeURIComponent(fileName)}?tier=${tier}`;
      if (this.prefetchedUrls.has(url)) continue;

      this.lastRequestedIndex = idx;

      try {
        await this.fetchImage(url, controller.signal);
        this.recordPrefetched(url);
      } catch (err: any) {
        if (err?.name === 'AbortError' || controller.signal.aborted) {
          break; // Stop cleanly on abort
        }
        // Suppress 404 or network errors silently without breaking next pages
      }
    }

    if (this.activeAbortController === controller) {
      this.isPrefetching = false;
      this.activeAbortController = null;
    }
  }

  private async fetchImage(url: string, signal: AbortSignal): Promise<void> {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Purpose': 'prefetch',
      },
      signal,
    });

    if (!res.ok) return;

    // Convert to blob and trigger async decode to prewarm the GPU texture cache
    const blob = await res.blob();
    if (typeof Image !== 'undefined' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      const objectUrl = URL.createObjectURL(blob);
      try {
        const img = new Image();
        img.decoding = 'async';
        img.src = objectUrl;
        await new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
        });
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    }
  }

  private recordPrefetched(url: string): void {
    if (this.prefetchedUrls.size >= this.maxCachedUrls) {
      const first = this.prefetchedUrls.values().next().value;
      if (first) this.prefetchedUrls.delete(first);
    }
    this.prefetchedUrls.add(url);
  }

  public getTelemetry(): PrefetchTelemetry {
    return {
      isPrefetching: this.isPrefetching,
      prefetchedCount: this.prefetchedUrls.size,
      lastRequestedIndex: this.lastRequestedIndex,
      currentTier: networkStatusService.getNetworkStatus().tier,
      windowForward: this.windowForward,
      windowBackward: this.windowBackward,
    };
  }

  public clear(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.activeAbortController) {
      this.activeAbortController.abort();
      this.activeAbortController = null;
    }
    this.isPrefetching = false;
    this.prefetchedUrls.clear();
  }

  public dispose(): void {
    this.clear();
  }
}
