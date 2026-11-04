import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import gsap from 'gsap';
import { ReaderDisplaySettings, buildImageFilter } from './ReaderVisualSettingsModal.js';

export interface ReaderPageItem {
  id: number;
  pageNumber: number;
  fileName: string;
  width: number;
  height: number;
  aspectRatio: number;
}

export interface WebtoonReaderProps {
  pages: ReaderPageItem[];
  storageBaseUrl: string;
  onPageVisible?: (pageNumber: number) => void;
  // Sprint 10.3: Visual customizer & Ambilight settings
  displaySettings?: ReaderDisplaySettings;
}

interface WebtoonPanelProps {
  page: ReaderPageItem;
  imageUrl: string;
  imageFilter?: string;
  ambilightEnabled?: boolean;
  ambilightIntensity?: number;
  onImageLoad?: (pageNumber: number) => void;
}

const WebtoonPanel: React.FC<WebtoonPanelProps> = ({
  page,
  imageUrl,
  imageFilter,
  ambilightEnabled = false,
  ambilightIntensity = 100,
  onImageLoad,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLImageElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const hasAnimatedRef = useRef<boolean>(false);

  const triggerEntrance = useCallback(() => {
    if (hasAnimatedRef.current) return;
    hasAnimatedRef.current = true;

    // Ultra-fluid opacity entrance without y-translation to eliminate scroll jitter
    if (panelRef.current) {
      gsap.fromTo(
        panelRef.current,
        { opacity: 0.8 },
        {
          opacity: 1,
          duration: 0.12,
          ease: 'power2.out',
          clearProps: 'opacity',
        }
      );
    }

    if (glowRef.current && ambilightEnabled) {
      gsap.to(glowRef.current, {
        opacity: 0.28 * (ambilightIntensity / 100),
        duration: 0.3,
        ease: 'power2.out',
      });
    }
  }, [ambilightEnabled, ambilightIntensity]);

  // Handle in-place changes to Ambilight settings
  useEffect(() => {
    if (glowRef.current && ambilightEnabled) {
      gsap.to(glowRef.current, {
        opacity: 0.28 * (ambilightIntensity / 100),
        duration: 0.2,
        ease: 'power2.out',
      });
    }
  }, [ambilightEnabled, ambilightIntensity]);

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;

    if (typeof IntersectionObserver !== 'undefined') {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              triggerEntrance();
            }
          });
        },
        { rootMargin: '300px 0px 300px 0px', threshold: 0.02 }
      );

      observer.observe(el);
      return () => observer.disconnect();
    } else {
      // In non-browser / test environments (e.g., jsdom)
      triggerEntrance();
    }
  }, [triggerEntrance]);

  return (
    <div
      ref={panelRef}
      id={`page-${page.pageNumber}`}
      data-reader-page
      data-page-number={page.pageNumber}
      style={{
        aspectRatio: page.aspectRatio > 0 ? page.aspectRatio : 0.666,
        contain: 'layout paint',
      }}
      className="w-full relative bg-[#090d16] flex items-center justify-center overflow-visible select-none"
    >
      {/* Soft Ambient Lighting - bypassed when disabled for maximum scroll fluidity */}
      <div
        className={`absolute -inset-x-8 sm:-inset-x-16 inset-y-0 -z-10 pointer-events-none overflow-hidden select-none ${
          ambilightEnabled ? '' : 'hidden'
        }`}
      >
        <img
          ref={glowRef}
          src={imageUrl}
          alt=""
          aria-hidden="true"
          className="w-full h-full object-cover filter blur-[32px] saturate-[1.3] opacity-0 transform-gpu pointer-events-none"
        />
      </div>

      {/* Aspect Ratio Skeleton Placeholder to guarantee 0 CLS */}
      <div className="absolute inset-0 flex items-center justify-center text-slate-600 text-xs font-mono bg-[#0c1220]/90 border border-white/[0.03]">
        <span className="tracking-wider">Página {page.pageNumber}</span>
      </div>

      {/* Optimized WebP Page Image */}
      <img
        ref={imageRef}
        src={imageUrl}
        alt={`Página ${page.pageNumber}`}
        loading="lazy"
        decoding="async"
        style={{ filter: imageFilter || 'none' }}
        className="w-full h-full object-contain relative z-10 block pointer-events-none shadow-2xl"
        onLoad={() => {
          triggerEntrance();
          onImageLoad?.(page.pageNumber);
        }}
      />
    </div>
  );
};

export const WebtoonReader: React.FC<WebtoonReaderProps> = ({
  pages,
  storageBaseUrl,
  onPageVisible,
  displaySettings,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const [activePage, setActivePage] = useState<number>(1);
  const prevPageRef = useRef<number>(1);
  const activePageRef = useRef<number>(1);
  const onPageVisibleRef = useRef(onPageVisible);

  useEffect(() => {
    onPageVisibleRef.current = onPageVisible;
  }, [onPageVisible]);

  const imageFilter = useMemo(() => buildImageFilter(displaySettings), [displaySettings]);
  const channelMaxWidth =
    displaySettings?.webtoonMaxWidth === '100%'
      ? '100%'
      : displaySettings?.webtoonMaxWidth ?? '900px';
  const channelGap = displaySettings?.webtoonGap ?? '0px';

  // Use one viewport anchor for progress. IntersectionObserver callbacks from
  // individual pages can arrive out of order, especially with a positive root
  // margin and lazy image loads, which made the displayed percentage jump.
  const updateActivePage = useCallback(() => {
    const container = containerRef.current;
    if (!container || typeof window === 'undefined') return;

    const panels = Array.from(container.querySelectorAll<HTMLElement>('[data-reader-page]'));
    if (panels.length === 0) return;

    const anchorY = Math.min(window.innerHeight - 1, Math.max(72, window.innerHeight * 0.35));
    const containerTop = container.getBoundingClientRect().top;
    const anchorInContainer = anchorY - containerTop;
    const getLayoutBounds = (panel: HTMLElement): { top: number; bottom: number } => {
      let top = 0;
      let node: HTMLElement | null = panel;
      while (node && node !== container) {
        top += node.offsetTop;
        node = node.offsetParent as HTMLElement | null;
      }
      // The offset-parent chain normally reaches the reader container. The
      // fallback handles unusual browser layouts while still preferring
      // layout dimensions over the entrance animation's transformed bounds.
      if (node !== container) {
        const bounds = panel.getBoundingClientRect();
        return { top: bounds.top - containerTop, bottom: bounds.bottom - containerTop };
      }
      return { top, bottom: top + panel.offsetHeight };
    };
    // Page order is vertical, so binary search avoids measuring every panel on
    // each scroll frame in long chapters.
    let low = 0;
    let high = panels.length - 1;
    let selectedIndex = -1;
    while (low <= high) {
      const middle = (low + high) >> 1;
      const bounds = getLayoutBounds(panels[middle]);
      if (anchorInContainer < bounds.top) {
        high = middle - 1;
      } else if (anchorInContainer >= bounds.bottom) {
        low = middle + 1;
      } else {
        selectedIndex = middle;
        break;
      }
    }

    if (selectedIndex < 0) {
      const previousIndex = Math.max(0, Math.min(panels.length - 1, high));
      const nextIndex = Math.max(0, Math.min(panels.length - 1, low));
      const previousBounds = getLayoutBounds(panels[previousIndex]);
      const nextBounds = getLayoutBounds(panels[nextIndex]);
      const previousDistance = anchorInContainer < previousBounds.top
        ? previousBounds.top - anchorInContainer
        : anchorInContainer - previousBounds.bottom;
      const nextDistance = anchorInContainer < nextBounds.top
        ? nextBounds.top - anchorInContainer
        : anchorInContainer - nextBounds.bottom;
      selectedIndex = previousDistance <= nextDistance ? previousIndex : nextIndex;
    }

    const pageNumber = Number(panels[selectedIndex]?.dataset.pageNumber);
    if (!Number.isSafeInteger(pageNumber) || pageNumber < 1 || pageNumber === activePageRef.current) return;

    activePageRef.current = pageNumber;
    setActivePage(pageNumber);
    onPageVisibleRef.current?.(pageNumber);
  }, []);

  useEffect(() => {
    let frameId: number | null = null;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleUpdate = () => {
      if (frameId !== null || fallbackTimer !== null) return;
      const runUpdate = () => {
        frameId = null;
        fallbackTimer = null;
        updateActivePage();
      };
      if (typeof window.requestAnimationFrame === 'function') {
        frameId = window.requestAnimationFrame(runUpdate);
      } else {
        fallbackTimer = setTimeout(runUpdate, 16);
      }
    };

    activePageRef.current = 1;
    setActivePage(1);
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate, { passive: true });
    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(scheduleUpdate)
      : null;
    if (resizeObserver && containerRef.current) resizeObserver.observe(containerRef.current);
    scheduleUpdate();

    return () => {
      window.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
      resizeObserver?.disconnect();
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      if (fallbackTimer !== null) clearTimeout(fallbackTimer);
    };
  }, [pages, updateActivePage]);

  // Micro-interaction bounce on active page indicator update
  useEffect(() => {
    if (activePage !== prevPageRef.current && pillRef.current) {
      gsap.fromTo(
        pillRef.current,
        { scale: 0.93 },
        {
          scale: 1,
          duration: 0.25,
          ease: 'back.out(1.4)',
        }
      );
      prevPageRef.current = activePage;
    }
  }, [activePage]);

  // Root GSAP context for safe lifecycle cleanup
  useEffect(() => {
    if (!containerRef.current) return;
    const ctx = gsap.context(() => {}, containerRef);
    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full bg-transparent overflow-x-hidden select-none relative min-h-screen"
    >
      {/* Central Reading Channel */}
      <div
        data-testid="webtoon-reading-channel"
        style={{
          maxWidth: channelMaxWidth,
          gap: channelGap,
        }}
        className="w-full mx-auto flex flex-col items-center relative border-x border-white/[0.04] shadow-2xl transition-[max-width,gap] duration-200"
      >
        {pages.map((p) => {
          const imageUrl = `${storageBaseUrl}/${p.fileName}`;
          return (
            <WebtoonPanel
              key={p.pageNumber}
              page={p}
              imageUrl={imageUrl}
              imageFilter={imageFilter}
              ambilightEnabled={displaySettings?.ambilightEnabled ?? false}
              ambilightIntensity={displaySettings?.ambilightIntensity ?? 100}
              onImageLoad={(pageNum) => {
                onPageVisible?.(pageNum);
              }}
            />
          );
        })}
      </div>

      {/* Floating Webtoon Progress Indicator Pill */}
      <div
        ref={pillRef}
        className="fixed bottom-4 left-1/2 -translate-x-1/2 px-3.5 py-1.5 rounded-full bg-[#0f172a]/90 backdrop-blur-md border border-white/10 text-xs font-mono text-slate-300 shadow-2xl pointer-events-none flex items-center gap-1.5 z-30 tracking-wide"
      >
        <span>
          <span className="text-cyan-400 font-semibold">{activePage}</span> / {pages.length}
        </span>
        <span className="text-slate-600">•</span>
        <span className="text-slate-400">Webtoon</span>
      </div>
    </div>
  );
};
