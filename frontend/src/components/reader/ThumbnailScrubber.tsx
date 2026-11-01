import React, { useRef, useEffect, useState, useCallback } from 'react';
import { X, ChevronUp, ChevronDown } from 'lucide-react';

export interface ScrubberPageItem {
  id?: number | string;
  pageNumber: number;
  fileName: string;
  aspectRatio?: number;
  width?: number;
  height?: number;
}

export interface ThumbnailScrubberProps {
  pages: ScrubberPageItem[];
  currentPage: number;
  storageBaseUrl: string;
  isOpen?: boolean;
  onSelectPage: (pageNumber: number) => void;
  onClose?: () => void;
  onToggle?: () => void;
}

export const ThumbnailScrubber: React.FC<ThumbnailScrubberProps> = ({
  pages,
  currentPage,
  storageBaseUrl,
  isOpen = false,
  onSelectPage,
  onClose,
  onToggle,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const filmstripRef = useRef<HTMLDivElement>(null);
  const activeThumbRef = useRef<HTMLButtonElement | null>(null);

  // Drawer is visible either if explicitly open or hovered near the bottom edge
  const isExpanded = isOpen || isHovered;

  // Auto-scroll the active thumbnail into the center of the filmstrip
  const scrollToActive = useCallback(() => {
    if (activeThumbRef.current) {
      activeThumbRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, []);

  useEffect(() => {
    if (isExpanded) {
      // Small timeout to allow container layout calculation
      const timer = setTimeout(scrollToActive, 100);
      return () => clearTimeout(timer);
    }
  }, [isExpanded, currentPage, scrollToActive]);

  // Convert mouse wheel vertical scroll to horizontal filmstrip scroll
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (filmstripRef.current && e.deltaY !== 0) {
      filmstripRef.current.scrollLeft += e.deltaY;
    }
  };

  const handleSelect = (pageNumber: number) => {
    onSelectPage(pageNumber);
  };

  return (
    <div
      data-testid="thumbnail-scrubber-wrapper"
      className="fixed bottom-0 inset-x-0 z-40 select-none pointer-events-none"
    >
      {/* Invisible Hover Sensor Area at the bottom edge */}
      <div
        data-testid="scrubber-hover-trigger"
        onMouseEnter={() => setIsHovered(true)}
        className="h-6 w-full pointer-events-auto cursor-pointer flex items-center justify-center"
      >
        {!isExpanded && (
          <div className="px-3 py-0.5 rounded-t-lg bg-[#080c14]/90 border-t border-x border-gray-800/80 backdrop-blur-md text-[11px] text-gray-400 flex items-center gap-1 shadow-lg transition-all hover:text-white hover:bg-gray-900">
            <ChevronUp className="w-3.5 h-3.5 text-[#dc2626] animate-bounce" />
            <span>Miniaturas</span>
          </div>
        )}
      </div>

      {/* Sliding Horizontal Filmstrip Drawer */}
      <div
        data-testid="thumbnail-scrubber"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`w-full bg-[#080c14]/95 backdrop-blur-md border-t border-gray-800 text-white shadow-2xl transition-transform duration-300 ease-out pointer-events-auto ${
          isExpanded ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {/* Drawer Header: Page Counter, Handle & Close Button */}
        <div className="px-4 py-2 flex items-center justify-between border-b border-gray-800/60 bg-gray-950/40">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#dc2626] animate-pulse" />
            <span data-testid="scrubber-page-counter" className="text-xs font-medium text-gray-300">
              Página <strong className="text-[#dc2626] font-bold">{currentPage}</strong> de {pages.length}
            </span>
            <span className="text-gray-600 text-xs hidden sm:inline">•</span>
            <span className="text-[11px] text-gray-400 hidden sm:inline">
              Previsualización rápida de páginas
            </span>
          </div>

          {/* Center drag handle indicator */}
          <div
            onClick={onToggle}
            className="w-12 h-1 bg-gray-700 hover:bg-gray-500 rounded-full cursor-pointer transition-colors hidden md:block"
            title="Arrastrar / Toggle"
          />

          {/* Close Scrubber Button */}
          <div className="flex items-center gap-2">
            <button
              data-testid="close-scrubber-btn"
              onClick={() => {
                setIsHovered(false);
                onClose?.();
              }}
              className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800/80 transition-colors"
              title="Ocultar miniaturas"
              aria-label="Ocultar miniaturas"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Horizontal Filmstrip of Thumbnails */}
        <div
          ref={filmstripRef}
          onWheel={handleWheel}
          data-testid="scrubber-filmstrip"
          className="flex items-center gap-3 px-4 py-3 overflow-x-auto scroll-smooth scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent"
          tabIndex={0}
          role="region"
          aria-label="Tira de miniaturas de páginas"
        >
          {pages.map((p) => {
            const isActive = p.pageNumber === currentPage;
            const imageUrl = `${storageBaseUrl}/${p.fileName}`;

            return (
              <button
                key={p.pageNumber}
                ref={isActive ? activeThumbRef : null}
                data-testid={`thumbnail-item-${p.pageNumber}`}
                onClick={() => handleSelect(p.pageNumber)}
                aria-label={`Ir a página ${p.pageNumber}`}
                aria-current={isActive ? 'page' : undefined}
                className={`group relative shrink-0 rounded-lg overflow-hidden transition-all duration-200 cursor-pointer flex flex-col items-center focus:outline-none ${
                  isActive
                    ? 'border-2 border-[#dc2626] ring-2 ring-[#dc2626]/50 shadow-[0_0_14px_rgba(220,38,38,0.55)] scale-105 z-10'
                    : 'border border-gray-800/80 hover:border-gray-500 opacity-70 hover:opacity-100 hover:scale-102'
                }`}
                style={{
                  width: '5.5rem', // 88px
                  height: '8rem', // 128px
                  borderColor: isActive ? '#dc2626' : undefined,
                }}
              >
                {/* Fallback Skeleton behind thumbnail */}
                <div className="absolute inset-0 bg-[#0c1220] flex items-center justify-center text-[10px] text-gray-600 font-mono">
                  P.{p.pageNumber}
                </div>

                {/* Thumbnail Image */}
                <img
                  src={imageUrl}
                  alt={`Página ${p.pageNumber}`}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover relative z-0 pointer-events-none"
                  onError={(e) => {
                    // Gracefully hide broken image icon to preserve clean UI
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />

                {/* Page Number Badge */}
                <div
                  className={`absolute bottom-1 px-1.5 py-0.5 rounded text-[10px] font-mono tracking-tight shadow-md transition-colors ${
                    isActive
                      ? 'bg-[#dc2626] text-white font-bold'
                      : 'bg-black/80 text-gray-300 group-hover:text-white'
                  }`}
                  style={{
                    backgroundColor: isActive ? '#dc2626' : undefined,
                  }}
                >
                  {p.pageNumber}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
