import React, { useState } from 'react';
import { PageAnnotationItem, TYPE_ICONS, COLOR_CLASSES, AnnotationColor } from './AnnotationDeckHUD';

export interface StickyNoteOverlayProps {
  pageNumber: number;
  annotations: PageAnnotationItem[];
  isEditable?: boolean;
  onCanvasClick?: (coords: { anchorX: number; anchorY: number }) => void;
  onDeleteAnnotation?: (id: number) => void;
}

export const StickyNoteOverlay: React.FC<StickyNoteOverlayProps> = ({
  pageNumber,
  annotations,
  isEditable = false,
  onCanvasClick,
  onDeleteAnnotation,
}) => {
  const [activePinId, setActivePinId] = useState<number | null>(null);
  const [revealedSpoilers, setRevealedSpoilers] = useState<Record<number, boolean>>({});

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only trigger if click was directly on the container backdrop, not a pin
    if (e.target !== e.currentTarget) return;
    if (!isEditable || !onCanvasClick) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const anchorX = Math.max(0, Math.min(100, (x / rect.width) * 100));
    const anchorY = Math.max(0, Math.min(100, (y / rect.height) * 100));

    onCanvasClick({
      anchorX: Math.round(anchorX * 100) / 100,
      anchorY: Math.round(anchorY * 100) / 100,
    });
  };

  const togglePin = (id: number) => {
    setActivePinId((prev) => (prev === id ? null : id));
  };

  const toggleRevealSpoiler = (id: number) => {
    setRevealedSpoilers((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const pageAnnotations = annotations.filter((a) => a.pageNumber === pageNumber);

  return (
    <div
      data-testid={`sticky-overlay-page-${pageNumber}`}
      onClick={handleContainerClick}
      className={`absolute inset-0 z-30 select-none ${
        isEditable ? 'cursor-crosshair pointer-events-auto' : 'pointer-events-none'
      }`}
      style={{ willChange: 'transform' }}
    >
      {pageAnnotations.map((ann) => {
        const isActive = activePinId === ann.id;
        const colorStyle = COLOR_CLASSES[ann.colorPreset] || COLOR_CLASSES.yellow;
        const isHiddenSpoiler = ann.isSpoiler && !revealedSpoilers[ann.id];

        return (
          <div
            key={ann.id}
            data-testid={`annotation-pin-${ann.id}`}
            style={{
              position: 'absolute',
              left: `${ann.anchorX}%`,
              top: `${ann.anchorY}%`,
              transform: 'translate3d(-50%, -50%, 0)',
              pointerEvents: 'auto',
            }}
            className="group"
          >
            {/* Pin Marker Icon */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                togglePin(ann.id);
              }}
              data-testid={`pin-marker-btn-${ann.id}`}
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs shadow-md border cursor-pointer transition-transform duration-150 ${
                colorStyle.bg
              } ${colorStyle.border} ${isActive ? 'scale-125 ring-2 ring-amber-400' : 'hover:scale-110'}`}
              title={`${ann.annotationType}: ${ann.contentText.slice(0, 30)}`}
            >
              <span>{TYPE_ICONS[ann.annotationType]}</span>
            </button>

            {/* Popup Tooltip / Note Card on click */}
            {isActive && (
              <div
                data-testid={`pin-card-${ann.id}`}
                onClick={(e) => e.stopPropagation()}
                className={`absolute left-1/2 bottom-full mb-2 -translate-x-1/2 w-64 p-3 rounded-lg border shadow-2xl bg-neutral-950/95 ${colorStyle.border} z-40 text-neutral-100 text-left`}
                style={{ willChange: 'transform' }}
              >
                <div className="flex items-center justify-between text-[11px] mb-1.5 pb-1 border-b border-neutral-800">
                  <span className="font-semibold text-neutral-300 flex items-center gap-1">
                    <span>{TYPE_ICONS[ann.annotationType]}</span>
                    <span className="capitalize">{ann.annotationType.replace('_', ' ')}</span>
                  </span>
                  <div className="flex items-center gap-1">
                    {ann.isSpoiler && (
                      <span className="px-1 text-[9px] font-bold uppercase rounded bg-red-950 text-red-400 border border-red-800">
                        Spoiler
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setActivePinId(null)}
                      className="text-neutral-400 hover:text-neutral-100 text-xs px-1"
                     aria-label="Cerrar">&times;</button>
                  </div>
                </div>

                {isHiddenSpoiler ? (
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleRevealSpoiler(ann.id)}
                    className="px-2 py-1.5 bg-neutral-900 border border-dashed border-red-900/60 rounded text-[11px] text-neutral-400 cursor-pointer text-center select-none hover:bg-neutral-850"
                  >
                    <span className="font-semibold text-red-400">Spoiler</span> (Clic para mostrar)
                  </div>
                ) : (
                  <p className={`text-xs leading-relaxed break-words ${colorStyle.text}`}>
                    {ann.contentText}
                  </p>
                )}

                {onDeleteAnnotation && (
                  <div className="mt-2 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        onDeleteAnnotation(ann.id);
                        setActivePinId(null);
                      }}
                      className="text-[10px] text-red-400 hover:underline"
                    >
                      Eliminar nota
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
