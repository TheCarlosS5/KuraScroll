import { useEffect, useRef } from 'react';
import { AdaptivePrefetchController, PagePrefetchTarget } from './AdaptivePrefetchController';

export interface UseAdaptivePrefetchOptions {
  pages: Array<{ pageNumber: number; fileName: string; imageUrl?: string }>;
  currentPageIndex: number;
  chapterId: string;
  maxConcurrent?: number;
}

export function useAdaptivePrefetch({
  pages,
  currentPageIndex,
  chapterId,
  maxConcurrent = 2,
}: UseAdaptivePrefetchOptions): AdaptivePrefetchController {
  const controllerRef = useRef<AdaptivePrefetchController | null>(null);
  const lastIndexRef = useRef<number>(currentPageIndex);
  const lastTimeRef = useRef<number>(Date.now());

  if (!controllerRef.current) {
    controllerRef.current = new AdaptivePrefetchController({
      maxConcurrent,
      maxCachedBytes: 48 * 1024 * 1024, // 48MB client blob limit
    });
  }

  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller || pages.length === 0) return;

    const now = Date.now();
    const timeDelta = Math.max(1, now - lastTimeRef.current);
    const indexDelta = Math.abs(currentPageIndex - lastIndexRef.current);
    const velocity = indexDelta / (timeDelta / 1000); // pages per second

    lastIndexRef.current = currentPageIndex;
    lastTimeRef.current = now;

    // Adapt window size based on reading velocity
    let aheadCount = 3;
    let behindCount = 1;

    if (velocity > 3) {
      // Rapid fling / fast scroll: narrow down to immediate next
      aheadCount = 1;
      behindCount = 0;
    } else if (velocity > 1) {
      // Moderate speed
      aheadCount = 2;
      behindCount = 0;
    }

    const targets: PagePrefetchTarget[] = [];

    // Prioritize visible current page first
    const current = pages[currentPageIndex];
    if (current) {
      targets.push({
        id: `${chapterId}-${current.pageNumber}`,
        url: current.imageUrl || `/api/v1/chapters/${chapterId}/pages/${current.fileName}`,
      });
    }

    // Ahead pages
    for (let i = 1; i <= aheadCount; i++) {
      const idx = currentPageIndex + i;
      if (idx < pages.length) {
        const p = pages[idx];
        targets.push({
          id: `${chapterId}-${p.pageNumber}`,
          url: p.imageUrl || `/api/v1/chapters/${chapterId}/pages/${p.fileName}`,
        });
      }
    }

    // Behind pages
    for (let i = 1; i <= behindCount; i++) {
      const idx = currentPageIndex - i;
      if (idx >= 0) {
        const p = pages[idx];
        targets.push({
          id: `${chapterId}-${p.pageNumber}`,
          url: p.imageUrl || `/api/v1/chapters/${chapterId}/pages/${p.fileName}`,
        });
      }
    }

    controller.setPriority(targets);
  }, [pages, currentPageIndex, chapterId]);

  useEffect(() => {
    return () => {
      controllerRef.current?.destroy();
      controllerRef.current = null;
    };
  }, []);

  return controllerRef.current;
}
