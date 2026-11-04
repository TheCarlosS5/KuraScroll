import React, { useState, useEffect } from 'react';

export type AnnotationType = 'sticky_note' | 'panel_bookmark' | 'reaction';
export type AnnotationColor = 'yellow' | 'blue' | 'green' | 'pink' | 'purple';

export interface PageAnnotationItem {
  id: number;
  chapterId: string;
  pageNumber: number;
  userId: string;
  anchorX: number;
  anchorY: number;
  annotationType: AnnotationType;
  contentText: string;
  colorPreset: AnnotationColor;
  isSpoiler: boolean;
  createdAt: string;
}

export interface AnnotationDeckHUDProps {
  chapterId: string;
  currentPageNumber: number;
  annotations: PageAnnotationItem[];
  isOpen: boolean;
  onToggleOpen: () => void;
  onJumpToPage?: (pageNumber: number) => void;
  onCreateAnnotation?: (input: {
    pageNumber: number;
    anchorX: number;
    anchorY: number;
    contentText: string;
    annotationType: AnnotationType;
    colorPreset: AnnotationColor;
    isSpoiler: boolean;
  }) => void;
  onDeleteAnnotation?: (id: number) => void;
  onToggleSpoiler?: (id: number, isSpoiler: boolean) => void;
}

export const COLOR_CLASSES: Record<AnnotationColor, { bg: string; border: string; text: string }> = {
  yellow: { bg: 'bg-amber-950/40', border: 'border-amber-500/50', text: 'text-amber-300' },
  blue: { bg: 'bg-sky-950/40', border: 'border-sky-500/50', text: 'text-sky-300' },
  green: { bg: 'bg-emerald-950/40', border: 'border-emerald-500/50', text: 'text-emerald-300' },
  pink: { bg: 'bg-pink-950/40', border: 'border-pink-500/50', text: 'text-pink-300' },
  purple: { bg: 'bg-purple-950/40', border: 'border-purple-500/50', text: 'text-purple-300' },
};

export const TYPE_ICONS: Record<AnnotationType, string> = {
  sticky_note: 'Nota',
  panel_bookmark: 'Marca',
  reaction: 'Reacción',
};

export const AnnotationDeckHUD: React.FC<AnnotationDeckHUDProps> = ({
  chapterId,
  currentPageNumber,
  annotations,
  isOpen,
  onToggleOpen,
  onJumpToPage,
  onCreateAnnotation,
  onDeleteAnnotation,
  onToggleSpoiler,
}) => {
  const [activeFilter, setActiveFilter] = useState<'all' | AnnotationType>('all');
  const [newText, setNewText] = useState('');
  const [selectedType, setSelectedType] = useState<AnnotationType>('sticky_note');
  const [selectedColor, setSelectedColor] = useState<AnnotationColor>('yellow');
  const [isSpoilerInput, setIsSpoilerInput] = useState(false);
  const [revealedSpoilers, setRevealedSpoilers] = useState<Record<number, boolean>>({});

  // Global shortcut 'N' to toggle Annotation Deck
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName)) return;

      if (e.key.toLowerCase() === 'n') {
        e.preventDefault();
        onToggleOpen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onToggleOpen]);

  const filteredAnnotations = annotations.filter((ann) => {
    if (activeFilter === 'all') return true;
    return ann.annotationType === activeFilter;
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newText.trim() || !onCreateAnnotation) return;

    onCreateAnnotation({
      pageNumber: currentPageNumber,
      anchorX: 50.0,
      anchorY: 20.0,
      contentText: newText.trim(),
      annotationType: selectedType,
      colorPreset: selectedColor,
      isSpoiler: isSpoilerInput,
    });

    setNewText('');
    setIsSpoilerInput(false);
  };

  const toggleRevealSpoiler = (id: number) => {
    setRevealedSpoilers((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <>
      {/* Floating Toggle Button */}
      <button
        type="button"
        onClick={onToggleOpen}
        data-testid="annotation-deck-toggle"
        title="Panel de Anotaciones (Atajo: N)"
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-3 py-2 bg-neutral-900 border border-neutral-700 text-neutral-200 text-xs font-semibold rounded-lg shadow-lg hover:bg-neutral-800 hover:border-neutral-500 transition-colors"
      >
        <span className="text-cyan-400 font-mono text-xs">PIN</span>
        <span>Anotaciones</span>
        {annotations.length > 0 && (
          <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40 rounded-full">
            {annotations.length}
          </span>
        )}
      </button>

      {/* Off-Canvas Slide Drawer */}
      <aside
        data-testid="annotation-deck-drawer"
        aria-label="Annotation Deck"
        className={`fixed top-0 right-0 bottom-0 z-50 w-80 md:w-96 bg-neutral-950 border-l border-neutral-800 text-neutral-100 flex flex-col shadow-2xl transition-transform duration-200 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ willChange: 'transform' }}
      >
        {/* Header */}
        <header className="p-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/60">
          <div className="flex items-center gap-2">
            <span className="text-cyan-400 font-mono text-xs">PIN</span>
            <div>
              <h2 className="text-sm font-bold text-neutral-100 tracking-wide">Annotation Deck</h2>
              <p className="text-[11px] text-neutral-400">Página actual: {currentPageNumber} · {annotations.length} notas</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onToggleOpen}
            data-testid="annotation-deck-close"
            className="p-1.5 text-neutral-400 hover:text-neutral-100 rounded-md hover:bg-neutral-800 text-xs"
            title="Cerrar panel (Esc / N)"
           aria-label="Cerrar">&times;</button>
        </header>

        {/* Filter Tabs */}
        <div className="px-4 py-2 border-b border-neutral-800 flex items-center gap-1.5 bg-neutral-900/30 text-[11px]">
          {(['all', 'sticky_note', 'panel_bookmark', 'reaction'] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setActiveFilter(filter)}
              data-testid={`filter-tab-${filter}`}
              className={`px-2.5 py-1 rounded-md capitalize font-medium transition-colors ${
                activeFilter === filter
                  ? 'bg-neutral-800 text-amber-400 border border-amber-500/30'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
              }`}
            >
              {filter === 'all' ? 'Todas' : TYPE_ICONS[filter] + ' ' + filter.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Annotations List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3" data-testid="annotations-list">
          {filteredAnnotations.length === 0 ? (
            <div className="py-12 text-center text-xs text-neutral-500">
              <p className="text-xs text-zinc-500 mb-2 font-mono">SIN ANOTACIONES</p>
              <p>Sin anotaciones en este filtro.</p>
              <p className="text-[10px] mt-1 text-neutral-600">Haz clic en el lienzo o añade una nota abajo.</p>
            </div>
          ) : (
            filteredAnnotations.map((ann) => {
              const colorStyle = COLOR_CLASSES[ann.colorPreset] || COLOR_CLASSES.yellow;
              const isHiddenSpoiler = ann.isSpoiler && !revealedSpoilers[ann.id];

              return (
                <article
                  key={ann.id}
                  data-testid={`annotation-item-${ann.id}`}
                  className={`p-3 rounded-lg border ${colorStyle.bg} ${colorStyle.border} transition-all`}
                >
                  <div className="flex items-center justify-between text-[11px] mb-1.5">
                    <span className="flex items-center gap-1 font-semibold text-neutral-300">
                      <span>{TYPE_ICONS[ann.annotationType]}</span>
                      <span className="capitalize">{ann.annotationType.replace('_', ' ')}</span>
                      <button
                        type="button"
                        onClick={() => onJumpToPage && onJumpToPage(ann.pageNumber)}
                        className="ml-1 px-1.5 py-0.5 rounded bg-neutral-800/80 text-[10px] text-amber-400 hover:underline"
                        title="Saltar a página"
                      >
                        Pág. {ann.pageNumber}
                      </button>
                    </span>

                    <div className="flex items-center gap-1.5">
                      {ann.isSpoiler && (
                        <span className="px-1 text-[9px] font-bold uppercase rounded bg-red-950 text-red-400 border border-red-800">
                          Spoiler
                        </span>
                      )}
                      {onDeleteAnnotation && (
                        <button
                          type="button"
                          onClick={() => onDeleteAnnotation(ann.id)}
                          data-testid={`delete-annotation-${ann.id}`}
                          className="text-neutral-500 hover:text-red-400 text-xs px-1"
                          title="Eliminar"
                         aria-label="Cerrar">&times;</button>
                      )}
                    </div>
                  </div>

                  {/* Body with zero-blur spoiler protection */}
                  {isHiddenSpoiler ? (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => toggleRevealSpoiler(ann.id)}
                      onKeyDown={(e) => e.key === 'Enter' && toggleRevealSpoiler(ann.id)}
                      data-testid={`spoiler-censored-${ann.id}`}
                      className="px-2.5 py-2 bg-neutral-900 border border-dashed border-red-900/60 rounded text-[11px] text-neutral-400 cursor-pointer text-center select-none hover:bg-neutral-850"
                    >
                      <span className="font-semibold text-red-400">Contenido con spoiler</span> (Clic para mostrar)
                    </div>
                  ) : (
                    <p className={`text-xs leading-relaxed break-words ${colorStyle.text}`}>
                      {ann.contentText}
                    </p>
                  )}

                  <footer className="mt-2 text-[10px] text-neutral-500 flex items-center justify-between">
                    <span>Pos: {Math.round(ann.anchorX)}%, {Math.round(ann.anchorY)}%</span>
                    {onToggleSpoiler && (
                      <button
                        type="button"
                        onClick={() => onToggleSpoiler(ann.id, !ann.isSpoiler)}
                        className="hover:underline text-neutral-400"
                      >
                        {ann.isSpoiler ? 'Quitar spoiler' : 'Marcar spoiler'}
                      </button>
                    )}
                  </footer>
                </article>
              );
            })
          )}
        </div>

        {/* Quick Add Form */}
        {onCreateAnnotation && (
          <form
            onSubmit={handleCreateSubmit}
            data-testid="create-annotation-form"
            className="p-3 border-t border-neutral-800 bg-neutral-900/80 space-y-2.5"
          >
            <div className="flex items-center justify-between text-[11px] text-neutral-300">
              <label htmlFor="annotation-note-input" className="font-medium">
                Nueva nota (Pág. {currentPageNumber}):
              </label>
              <div className="flex items-center gap-1">
                {(['yellow', 'blue', 'green', 'pink', 'purple'] as AnnotationColor[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setSelectedColor(c)}
                    data-testid={`color-picker-${c}`}
                    className={`w-3.5 h-3.5 rounded-full border transition-transform ${
                      COLOR_CLASSES[c].border
                    } ${selectedColor === c ? 'scale-125 ring-2 ring-neutral-400' : 'opacity-70 hover:opacity-100'}`}
                    style={{
                      backgroundColor:
                        c === 'yellow' ? '#eab308' :
                        c === 'blue' ? '#38bdf8' :
                        c === 'green' ? '#34d399' :
                        c === 'pink' ? '#f472b6' : '#c084fc',
                    }}
                    title={c}
                  />
                ))}
              </div>
            </div>

            <textarea
              id="annotation-note-input"
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              placeholder="Escribe tu nota, reacción o marca de viñeta..."
              rows={2}
              className="w-full px-2.5 py-1.5 bg-neutral-950 border border-neutral-700 rounded-md text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-amber-500 resize-none"
            />

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-[11px] text-neutral-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isSpoilerInput}
                  onChange={(e) => setIsSpoilerInput(e.target.checked)}
                  className="rounded border-neutral-700 bg-neutral-950 text-red-500 focus:ring-0"
                />
                <span>Marcar como spoiler</span>
              </label>

              <button
                type="submit"
                disabled={!newText.trim()}
                className="px-3 py-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-neutral-950 font-bold text-xs rounded-md shadow transition-colors"
              >
                Añadir
              </button>
            </div>
          </form>
        )}
      </aside>
    </>
  );
};
