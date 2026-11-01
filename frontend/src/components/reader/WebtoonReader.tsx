import React from 'react';

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
}

export const WebtoonReader: React.FC<WebtoonReaderProps> = ({
  pages,
  storageBaseUrl,
  onPageVisible,
}) => {
  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-center select-none bg-black">
      {pages.map((p) => {
        const imageUrl = `${storageBaseUrl}/${p.fileName}`;

        return (
          <div
            key={p.pageNumber}
            id={`page-${p.pageNumber}`}
            style={{
              aspectRatio: p.aspectRatio > 0 ? p.aspectRatio : 0.666,
            }}
            className="w-full relative bg-[#090d16] flex items-center justify-center overflow-hidden"
          >
            {/* Aspect Ratio Skeleton Placeholder to guarantee 0 CLS */}
            <div className="absolute inset-0 flex items-center justify-center text-gray-700 text-xs font-mono">
              <span>Página {p.pageNumber}</span>
            </div>

            {/* Optimized WebP Page Image */}
            <img
              src={imageUrl}
              alt={`Página ${p.pageNumber}`}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-contain relative z-10 block pointer-events-none"
              onLoad={() => onPageVisible?.(p.pageNumber)}
            />
          </div>
        );
      })}
    </div>
  );
};
