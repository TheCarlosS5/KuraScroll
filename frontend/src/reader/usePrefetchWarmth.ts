/**
 * Sprint 59 - Client-Side Cache Warmth Store & Reactive Hook
 *
 * Designed using `useSyncExternalStore` for zero-overhead, tear-free subscription
 * to background prefetch warmth states without unnecessary React re-renders.
 */

import { useSyncExternalStore, useCallback } from 'react';

export type WarmthState = 'cold' | 'warming' | 'hot';

export interface WarmthEvent {
  chapterId: string;
  pageNumber: number;
  width?: number;
  state: WarmthState;
}

export interface NavigationNoticeClient {
  userId?: string;
  chapterId: string;
  pageNumber: number;
  previousPage?: number;
  dwellSeconds?: number;
  readingMode?: 'manga' | 'webtoon' | 'comic';
  isDoubleSpread?: boolean;
  totalPages?: number;
  nextChapterId?: string;
  prevChapterId?: string;
  targetWidth?: number;
}

class PrefetchWarmthStore {
  private cache: Map<string, WarmthState> = new Map();
  private listeners: Set<() => void> = new Set();

  public makeKey(chapterId: string, pageNumber: number, width: number = 1200): string {
    return `${chapterId}:${pageNumber}:${width}`;
  }

  public getSnapshot = (key: string): WarmthState => {
    return this.cache.get(key) || 'cold';
  };

  public setWarmth(chapterId: string, pageNumber: number, width: number = 1200, state: WarmthState): void {
    const key = this.makeKey(chapterId, pageNumber, width);
    const existing = this.cache.get(key) || 'cold';
    if (existing !== state) {
      this.cache.set(key, state);
      this.notifyListeners();
    }
  }

  public subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  public clear(): void {
    this.cache.clear();
    this.notifyListeners();
  }

  /**
   * Dispatch navigation telemetry to backend daemon to warm ahead
   */
  public async notifyNavigation(notice: NavigationNoticeClient): Promise<void> {
    const width = notice.targetWidth ?? 1200;
    // Optimistically mark current page as hot
    this.setWarmth(notice.chapterId, notice.pageNumber, width, 'hot');

    try {
      const response = await fetch('/api/v1/prefetch/navigate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notice),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.candidates && Array.isArray(data.candidates)) {
          for (const cand of data.candidates) {
            const candWidth = cand.targetWidth ?? width;
            const current = this.getSnapshot(this.makeKey(cand.chapterId, cand.pageNumber, candWidth));
            if (current === 'cold') {
              this.setWarmth(cand.chapterId, cand.pageNumber, candWidth, 'warming');
            }
          }
        }
      }
    } catch {
      // Offline fallback: fail silently without blocking reading
    }
  }
}

export const prefetchWarmthStore = new PrefetchWarmthStore();

export interface UsePrefetchWarmthReturn {
  warmth: WarmthState;
  isHot: boolean;
  isWarming: boolean;
  setWarmth: (state: WarmthState) => void;
  triggerPrefetch: (options?: Partial<NavigationNoticeClient>) => Promise<void>;
}

export function usePrefetchWarmth(
  chapterId: string,
  pageNumber: number,
  width: number = 1200
): UsePrefetchWarmthReturn {
  const key = prefetchWarmthStore.makeKey(chapterId, pageNumber, width);

  const subscribe = useCallback(
    (onStoreChange: () => void) => prefetchWarmthStore.subscribe(onStoreChange),
    []
  );

  const getSnapshot = useCallback(
    () => prefetchWarmthStore.getSnapshot(key),
    [key]
  );

  const warmth = useSyncExternalStore<WarmthState>(
    subscribe,
    getSnapshot,
    (): WarmthState => 'cold'
  );

  const setWarmth = useCallback(
    (state: WarmthState) => {
      prefetchWarmthStore.setWarmth(chapterId, pageNumber, width, state);
    },
    [chapterId, pageNumber, width]
  );

  const triggerPrefetch = useCallback(
    async (options?: Partial<NavigationNoticeClient>) => {
      await prefetchWarmthStore.notifyNavigation({
        chapterId,
        pageNumber,
        targetWidth: width,
        ...options,
      });
    },
    [chapterId, pageNumber, width]
  );

  return {
    warmth,
    isHot: warmth === 'hot',
    isWarming: warmth === 'warming',
    setWarmth,
    triggerPrefetch,
  };
}
