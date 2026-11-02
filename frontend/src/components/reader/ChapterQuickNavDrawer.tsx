import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Search, Bookmark, Check, BookOpen, ChevronRight, Trash2 } from 'lucide-react';
import { useChapterVirtualizer } from '../../reader/useChapterVirtualizer';

export interface QuickIndexChapter {
  chapterId: string;
  chapterNumber: number;
  title: string | null;
  pageCount: number;
  lastPageIndex: number;
  completed: boolean;
  bookmarkCount: number;
}

export interface QuickIndexData {
  seriesId: string;
  totalChapters: number;
  readChapters: number;
  totalBookmarks: number;
  chapters: QuickIndexChapter[];
}

export interface SeriesBookmarkItem {
  id: number;
  chapterId: string;
  chapterNumber?: number;
  pageIndex: number;
  note: string | null;
  createdAt: string;
}

export interface ChapterQuickNavDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  seriesId: string;
  currentChapterId?: string;
  currentPage?: number;
  onSelectChapter: (chapterId: string, page?: number) => void;
  quickIndexData?: QuickIndexData | null;
  bookmarks?: SeriesBookmarkItem[];
  onDeleteBookmark?: (bookmarkId: number) => Promise<void>;
  onToggleActiveBookmark?: () => Promise<void>;
}

export const ChapterQuickNavDrawer: React.FC<ChapterQuickNavDrawerProps> = ({
  isOpen,
  onClose,
  seriesId,
  currentChapterId,
  currentPage = 1,
  onSelectChapter,
  quickIndexData,
  bookmarks = [],
  onDeleteBookmark,
  onToggleActiveBookmark,
}) => {
  const [activeTab, setActiveTab] = useState<'chapters' | 'bookmarks'>('chapters');
  const [filterQuery, setFilterQuery] = useState('');
  const [jumpInput, setJumpInput] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const chapters = quickIndexData?.chapters || [];

  // Filtered chapters based on search query
  const filteredChapters = useMemo(() => {
    if (!filterQuery.trim()) return chapters;
    const q = filterQuery.toLowerCase();
    return chapters.filter(
      (ch) =>
        ch.chapterNumber.toString().includes(q) ||
        (ch.title && ch.title.toLowerCase().includes(q))
    );
  }, [chapters, filterQuery]);

  // Virtualizer for 48px rows
  const { startIndex, endIndex, totalHeight, offsetY, onScroll } = useChapterVirtualizer({
    total: filteredChapters.length,
    rowHeight: 48,
    viewportHeight: 450,
    overscan: 4,
  });

  const visibleChapters = useMemo(() => {
    return filteredChapters.slice(startIndex, endIndex);
  }, [filteredChapters, startIndex, endIndex]);

  const handleJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(jumpInput.trim());
    if (isNaN(num)) return;

    const matched = chapters.find((c) => c.chapterNumber === num);
    if (matched) {
      onSelectChapter(matched.chapterId);
      onClose();
    }
  };

  const readPercent = quickIndexData?.totalChapters
    ? Math.round((quickIndexData.readChapters / quickIndexData.totalChapters) * 100)
    : 0;

  return (
    <div
      data-testid="chapter-quick-nav-drawer"
      aria-hidden={!isOpen}
      className={`fixed inset-y-0 right-0 z-50 w-full max-w-sm sm:max-w-md flex flex-col shadow-2xl transition-transform duration-300 ease-out ${
        isOpen ? 'translate-x-0' : 'translate-x-full pointer-events-none'
      }`}
      style={{
        backgroundColor: 'var(--reader-bg, #18181A)',
        color: 'var(--reader-text, #E4E4E7)',
        borderLeft: '1px solid var(--reader-border, #3F3F46)',
        contain: 'layout paint',
      }}
    >
      {/* Drawer Header */}
      <div
        className="flex items-center justify-between p-4 border-b"
        style={{ borderColor: 'var(--reader-border, #3F3F46)' }}
      >
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-indigo-400" />
          <h2 className="text-base font-bold tracking-tight">Navegación de Capítulos</h2>
        </div>
        <button
          onClick={onClose}
          aria-label="Cerrar cajón"
          className="p-1.5 rounded-lg hover:bg-neutral-800 transition-colors"
          style={{ color: 'var(--reader-text, #E4E4E7)' }}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Progress & Stats Summary */}
      {quickIndexData && (
        <div
          className="px-4 py-2 text-xs flex items-center justify-between border-b"
          style={{
            backgroundColor: 'var(--reader-card-bg, #27272A)',
            borderColor: 'var(--reader-border, #3F3F46)',
          }}
        >
          <span className="font-medium">
            Progreso: {quickIndexData.readChapters} / {quickIndexData.totalChapters} leídos ({readPercent}%)
          </span>
          <span className="flex items-center gap-1 text-amber-400 font-semibold">
            <Bookmark className="w-3.5 h-3.5 fill-current" />
            {quickIndexData.totalBookmarks} marcadores
          </span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div
        className="flex border-b text-sm font-medium"
        style={{ borderColor: 'var(--reader-border, #3F3F46)' }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('chapters')}
          className={`flex-1 py-2.5 text-center border-b-2 transition-colors ${
            activeTab === 'chapters'
              ? 'border-indigo-500 font-bold text-indigo-400'
              : 'border-transparent text-neutral-400 hover:text-neutral-200'
          }`}
        >
          Capítulos ({chapters.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('bookmarks')}
          className={`flex-1 py-2.5 text-center border-b-2 transition-colors ${
            activeTab === 'bookmarks'
              ? 'border-indigo-500 font-bold text-indigo-400'
              : 'border-transparent text-neutral-400 hover:text-neutral-200'
          }`}
        >
          Marcadores ({bookmarks.length})
        </button>
      </div>

      {activeTab === 'chapters' ? (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Quick Jump & Filter Toolbar */}
          <div className="p-3 flex gap-2 border-b" style={{ borderColor: 'var(--reader-border, #3F3F46)' }}>
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-neutral-400" />
              <input
                type="text"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="Buscar capítulo..."
                className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border focus:outline-none focus:ring-1 focus:ring-indigo-500"
                style={{
                  backgroundColor: 'var(--reader-card-bg, #27272A)',
                  borderColor: 'var(--reader-border, #3F3F46)',
                  color: 'var(--reader-text, #E4E4E7)',
                }}
              />
            </div>
            <form onSubmit={handleJumpSubmit} className="flex gap-1 w-28">
              <input
                type="number"
                step="any"
                value={jumpInput}
                onChange={(e) => setJumpInput(e.target.value)}
                placeholder="Ir a #"
                className="w-full px-2 py-1.5 text-sm rounded-lg border text-center focus:outline-none focus:ring-1 focus:ring-indigo-500"
                style={{
                  backgroundColor: 'var(--reader-card-bg, #27272A)',
                  borderColor: 'var(--reader-border, #3F3F46)',
                  color: 'var(--reader-text, #E4E4E7)',
                }}
              />
              <button
                type="submit"
                aria-label="Ir al capítulo"
                className="px-2 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
              >
                Ir
              </button>
            </form>
          </div>

          {/* Virtualized Chapter List Container */}
          <div
            ref={containerRef}
            onScroll={onScroll}
            className="flex-1 overflow-y-auto relative divide-y"
            style={{
              borderColor: 'var(--reader-border, #3F3F46)',
              contain: 'strict',
            }}
          >
            {filteredChapters.length === 0 ? (
              <div className="p-8 text-center text-sm text-neutral-400">
                No se encontraron capítulos.
              </div>
            ) : (
              <div style={{ height: totalHeight, position: 'relative', width: '100%' }}>
                <div
                  style={{
                    transform: `translateY(${offsetY}px)`,
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                  }}
                >
                  {visibleChapters.map((ch) => {
                    const isCurrent = ch.chapterId === currentChapterId;
                    return (
                      <div
                        key={ch.chapterId}
                        onClick={() => {
                          onSelectChapter(ch.chapterId);
                          onClose();
                        }}
                        style={{ height: 48 }}
                        className={`px-4 flex items-center justify-between cursor-pointer transition-colors ${
                          isCurrent
                            ? 'bg-indigo-950/60 font-semibold text-indigo-300'
                            : 'hover:bg-neutral-800/50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <span className="text-sm font-mono w-10 text-neutral-400">
                            #{ch.chapterNumber}
                          </span>
                          <span className="text-sm truncate">
                            {ch.title || `Capítulo ${ch.chapterNumber}`}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {ch.bookmarkCount > 0 && (
                            <span className="flex items-center text-xs text-amber-400 font-medium">
                              <Bookmark className="w-3.5 h-3.5 fill-current mr-0.5" />
                              {ch.bookmarkCount}
                            </span>
                          )}
                          {ch.completed ? (
                            <span className="p-0.5 rounded-full bg-emerald-950 text-emerald-400">
                              <Check className="w-3.5 h-3.5" />
                            </span>
                          ) : ch.lastPageIndex > 1 ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400">
                              p.{ch.lastPageIndex}
                            </span>
                          ) : null}
                          <ChevronRight className="w-4 h-4 text-neutral-500" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Cross-Volume Bookmarks List */
        <div className="flex-1 overflow-y-auto divide-y" style={{ borderColor: 'var(--reader-border, #3F3F46)' }}>
          {bookmarks.length === 0 ? (
            <div className="p-8 text-center text-neutral-400 space-y-2">
              <Bookmark className="w-8 h-8 mx-auto text-neutral-600" />
              <p className="text-sm">No tienes marcadores guardados en esta serie.</p>
              <p className="text-xs text-neutral-500">
                Presiona la tecla <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 border font-mono">B</kbd> para marcar la página actual.
              </p>
            </div>
          ) : (
            bookmarks.map((bm) => (
              <div
                key={bm.id}
                className="p-3.5 flex items-start justify-between gap-3 hover:bg-neutral-800/40 transition-colors"
              >
                <div
                  className="flex-1 cursor-pointer"
                  onClick={() => {
                    onSelectChapter(bm.chapterId, bm.pageIndex);
                    onClose();
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-indigo-400">
                      Cap. {bm.chapterNumber ?? '?'} • Pág. {bm.pageIndex}
                    </span>
                    <span className="text-[10px] text-neutral-500">
                      {new Date(bm.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {bm.note && (
                    <p className="text-xs text-neutral-300 mt-1 line-clamp-2">
                      {bm.note}
                    </p>
                  )}
                </div>
                {onDeleteBookmark && (
                  <button
                    onClick={() => onDeleteBookmark(bm.id)}
                    aria-label="Eliminar marcador"
                    className="p-1 text-neutral-500 hover:text-rose-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Floating Active Page Quick Bookmark Action Button */}
      {onToggleActiveBookmark && (
        <div
          className="p-3 border-t flex items-center justify-between"
          style={{
            backgroundColor: 'var(--reader-card-bg, #27272A)',
            borderColor: 'var(--reader-border, #3F3F46)',
          }}
        >
          <div className="text-xs text-neutral-400">
            Página activa: <span className="font-bold text-neutral-200">#{currentPage}</span>
          </div>
          <button
            onClick={onToggleActiveBookmark}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
          >
            <Bookmark className="w-3.5 h-3.5 fill-current" />
            Marcar Página (<kbd className="font-mono">B</kbd>)
          </button>
        </div>
      )}
    </div>
  );
};
