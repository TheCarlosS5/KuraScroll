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
  onVisible: (pageNumber: number) => void;
  imageFilter?: string;
  ambilightEnabled?: boolean;
  ambilightIntensity?: number;
}

const WebtoonPanel: React.FC<WebtoonPanelProps> = ({
  page,
  imageUrl,
  onVisible,
  imageFilter,
  ambilightEnabled = true,
  ambilightIntensity = 100,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLImageElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const hasAnimatedRef = useRef<boolean>(false);

  const triggerEntrance = useCallback(() => {
    if (hasAnimatedRef.current) return;
    hasAnimatedRef.current = true;

    if (panelRef.current) {
      gsap.fromTo(
        panelRef.current,
        { opacity: 0.35, y: 18 },
        {
          opacity: 1,
          y: 0,
          duration: 0.5,
          ease: 'power3.out',
          clearProps: 'transform',
        }
      );
    }

    if (glowRef.current) {
      if (ambilightEnabled) {
        gsap.to(glowRef.current, {
          opacity: 0.28 * (ambilightIntensity / 100),
          duration: 0.8,
          ease: 'power2.out',
        });
      } else {
        gsap.set(glowRef.current, { opacity: 0 });
      }
    }
  }, [ambilightEnabled, ambilightIntensity]);

  // Handle in-place changes to Ambilight settings
  useEffect(() => {
    if (glowRef.current) {
      gsap.to(glowRef.current, {
        opacity: ambilightEnabled ? 0.28 * (ambilightIntensity / 100) : 0,
        duration: 0.3,
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
              onVisible(page.pageNumber);
            }
          });
        },
        { rootMargin: '200px 0px 200px 0px', threshold: 0.05 }
      );

      observer.observe(el);
      return () => observer.disconnect();
    } else {
      // In non-browser / test environments (e.g., jsdom)
      triggerEntrance();
    }
  }, [page.pageNumber, onVisible, triggerEntrance]);

  return (
    <div
      ref={panelRef}
      id={`page-${page.pageNumber}`}
      style={{
        aspectRatio: page.aspectRatio > 0 ? page.aspectRatio : 0.666,
      }}
      className="w-full relative bg-[#090d16] flex items-center justify-center overflow-visible select-none"
    >
      {/* Soft Ambient Lighting reflecting comic mood behind the webtoon panel */}
      <div className="absolute -inset-x-8 sm:-inset-x-16 inset-y-0 -z-10 pointer-events-none overflow-hidden select-none">
        <img
          ref={glowRef}
          src={imageUrl}
          alt=""
          aria-hidden="true"
          className="w-full h-full object-cover filter blur-[56px] sm:blur-[72px] saturate-[1.6] opacity-0 transform-gpu pointer-events-none"
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
          onVisible(page.pageNumber);
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

  const imageFilter = useMemo(() => buildImageFilter(displaySettings), [displaySettings]);
  const channelMaxWidth =
    displaySettings?.webtoonMaxWidth === '100%'
      ? '100%'
      : displaySettings?.webtoonMaxWidth ?? '900px';
  const channelGap = displaySettings?.webtoonGap ?? '0px';

  const handleVisible = useCallback(
    (pageNumber: number) => {
      setActivePage((prev) => (prev !== pageNumber ? pageNumber : prev));
      onPageVisible?.(pageNumber);
    },
    [onPageVisible]
  );

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
              onVisible={handleVisible}
              imageFilter={imageFilter}
              ambilightEnabled={displaySettings?.ambilightEnabled ?? true}
              ambilightIntensity={displaySettings?.ambilightIntensity ?? 100}
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
