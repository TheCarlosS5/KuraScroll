import React, { useEffect } from 'react';
import { GitMerge, X, ShieldAlert, Sparkles } from 'lucide-react';

export interface DuplicateCandidate {
  id: string;
  title: string;
  coverUrl?: string;
  chaptersCount: number;
  scanlationGroup?: string;
}

export interface DuplicatePair {
  id: string;
  similarityScore: number;
  jaroWinklerScore?: number;
  tokenDiceScore?: number;
  primarySeries: DuplicateCandidate;
  duplicateSeries: DuplicateCandidate;
}

export interface DuplicateSeriesReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  duplicatePair: DuplicatePair;
  onMerge: (primaryId: string, duplicateId: string) => void;
  onDismiss: (pairId: string) => void;
  onSetParentChild?: (parentId: string, childId: string) => void;
}

export const DuplicateSeriesReviewModal: React.FC<DuplicateSeriesReviewModalProps> = ({
  isOpen,
  onClose,
  duplicatePair,
  onMerge,
  onDismiss,
  onSetParentChild,
}) => {
  // Accessible keyboard shortcuts (Escape to close)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const scorePercent = Math.round(duplicatePair.similarityScore * 100);
  const isHighMatch = scorePercent >= 90;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      style={{ contain: 'layout paint' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="duplicate-modal-title"
    >
      <div className="bg-[var(--reader-card-bg,#18181B)] border border-[var(--reader-border,#27272A)] rounded-2xl w-full max-w-3xl p-6 text-gray-100 shadow-2xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <GitMerge className="w-5 h-5 text-cyan-400" />
            <h2 id="duplicate-modal-title" className="text-lg font-bold text-gray-100">
              Revisión de Posible Duplicado
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold border flex items-center gap-1.5 ${
                isHighMatch
                  ? 'bg-emerald-950/80 border-emerald-700 text-emerald-300'
                  : 'bg-amber-950/80 border-amber-700 text-amber-300'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Similitud Jaro-Winkler: {scorePercent}%
            </span>
            <button
              onClick={onClose}
              aria-label="Cerrar modal"
              className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <p className="text-xs text-gray-400 mb-4">
          Compara las dos series detectadas. Al fusionar, los capítulos y el progreso de lectura se consolidarán en la serie principal sin perder datos.
        </p>

        {/* Side-by-side comparison */}
        <div className="grid grid-cols-2 gap-6 my-4">
          {/* Serie A (Principal) */}
          <div className="p-4 bg-zinc-900/90 rounded-xl border border-zinc-800 flex flex-col justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 mb-2">
                Serie Principal (Destino)
              </div>
              <div className="aspect-[3/4] rounded-lg overflow-hidden bg-zinc-800 mb-3 flex items-center justify-center">
                {duplicatePair.primarySeries.coverUrl ? (
                  <img
                    src={duplicatePair.primarySeries.coverUrl}
                    alt={duplicatePair.primarySeries.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <span className="text-zinc-600 text-xs">Sin Portada</span>
                )}
              </div>
              <h3 className="font-semibold text-sm truncate text-gray-100" title={duplicatePair.primarySeries.title}>
                {duplicatePair.primarySeries.title}
              </h3>
            </div>
            <div className="mt-3 pt-3 border-t border-zinc-800/80 space-y-1">
              <p className="text-xs text-gray-400">
                Capítulos: <span className="text-gray-200 font-medium">{duplicatePair.primarySeries.chaptersCount}</span>
              </p>
              {duplicatePair.primarySeries.scanlationGroup && (
                <p className="text-xs text-cyan-400">
                  Scan: <span className="font-medium">{duplicatePair.primarySeries.scanlationGroup}</span>
                </p>
              )}
            </div>
          </div>

          {/* Serie B (Duplicado Detectado) */}
          <div className="p-4 bg-zinc-900/90 rounded-xl border border-zinc-800 flex flex-col justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400 mb-2">
                Duplicado Detectado (Origen)
              </div>
              <div className="aspect-[3/4] rounded-lg overflow-hidden bg-zinc-800 mb-3 flex items-center justify-center">
                {duplicatePair.duplicateSeries.coverUrl ? (
                  <img
                    src={duplicatePair.duplicateSeries.coverUrl}
                    alt={duplicatePair.duplicateSeries.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <span className="text-zinc-600 text-xs">Sin Portada</span>
                )}
              </div>
              <h3 className="font-semibold text-sm truncate text-gray-100" title={duplicatePair.duplicateSeries.title}>
                {duplicatePair.duplicateSeries.title}
              </h3>
            </div>
            <div className="mt-3 pt-3 border-t border-zinc-800/80 space-y-1">
              <p className="text-xs text-gray-400">
                Capítulos: <span className="text-gray-200 font-medium">{duplicatePair.duplicateSeries.chaptersCount}</span>
              </p>
              {duplicatePair.duplicateSeries.scanlationGroup && (
                <p className="text-xs text-amber-400">
                  Scan: <span className="font-medium">{duplicatePair.duplicateSeries.scanlationGroup}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-zinc-800">
          <button
            onClick={() => onDismiss(duplicatePair.id)}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-gray-300 rounded-lg text-xs font-medium transition-colors"
          >
            Mantener Separadas (Dismiss)
          </button>
          {onSetParentChild && (
            <button
              onClick={() => onSetParentChild(duplicatePair.primarySeries.id, duplicatePair.duplicateSeries.id)}
              className="px-4 py-2 bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-700 rounded-lg text-xs font-medium transition-colors"
            >
              Marcar Padre / Hijo
            </button>
          )}
          <button
            onClick={() => onMerge(duplicatePair.primarySeries.id, duplicatePair.duplicateSeries.id)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-lg shadow-emerald-950"
          >
            <GitMerge className="w-3.5 h-3.5" />
            Fusionar Series (Merge)
          </button>
        </div>
      </div>
    </div>
  );
};
