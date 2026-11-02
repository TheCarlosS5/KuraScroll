/**
 * KuraScroll Furigana & Manga Lore Lexicon HUD
 * Sprint 62 - Zero-Latency Japanese Kanji Furigana & Manhwa Lore Terminology Popover
 *
 * Hardware-conscious design for Intel GMA 4500MHD GPU:
 * - Pure solid background (#18181b, 0 CSS blur, 0 backdrop-filter)
 * - 0 CLS: Strict layout containment (`contain: layout paint`)
 * - Native HTML5 <ruby> and <rt> semantic phonetics
 */

import React, { useEffect, useRef } from 'react';
import { BookOpen, X, Sparkles, Volume2 } from 'lucide-react';
import { LexiconEntry, LexiconCategory } from '../../reader/useFuriganaLexicon.js';

export interface FuriganaLexiconHUDProps {
  entry: LexiconEntry | null;
  isOpen: boolean;
  onClose: () => void;
  position: { x: number; y: number };
  error?: string | null;
  isLoading?: boolean;
  className?: string;
}

export const FuriganaLexiconHUD: React.FC<FuriganaLexiconHUDProps> = ({
  entry,
  isOpen,
  onClose,
  position,
  error,
  isLoading,
  className = '',
}) => {
  const cardRef = useRef<HTMLDivElement>(null);

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

  const getCategoryBadgeClass = (category?: LexiconCategory): string => {
    switch (category) {
      case 'SERIES_LORE':
        return 'bg-indigo-950 border-indigo-600 text-indigo-300';
      case 'KANJI':
        return 'bg-emerald-950 border-emerald-600 text-emerald-300';
      case 'VOCAB':
        return 'bg-amber-950 border-amber-600 text-amber-300';
      case 'SFX':
        return 'bg-rose-950 border-rose-600 text-rose-300';
      case 'NAME':
      default:
        return 'bg-violet-950 border-violet-600 text-violet-300';
    }
  };

  // Clamped viewport position to prevent edge overflow
  const clampedX = Math.max(12, Math.min(window.innerWidth - 320, position.x));
  const clampedY = Math.max(12, Math.min(window.innerHeight - 240, position.y));

  return (
    <div
      ref={cardRef}
      className={`fixed z-50 w-76 rounded-lg bg-zinc-900 border border-zinc-700 shadow-xl text-zinc-100 p-3 select-none pointer-events-auto ${className}`}
      style={{
        left: `${clampedX}px`,
        top: `${clampedY}px`,
        contain: 'layout paint',
      }}
      role="tooltip"
      aria-label={entry ? `Glosario de ${entry.term}` : 'Glosario Furigana y Lore'}
    >
      {/* Top Header Row */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-800">
        <div className="flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-xs font-semibold text-zinc-300">Glosario & Lore</span>
          {entry?.category && (
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase border ${getCategoryBadgeClass(
                entry.category
              )}`}
            >
              {entry.category.replace('_', ' ')}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 text-zinc-400 hover:text-white rounded hover:bg-zinc-800 transition-colors"
          title="Cerrar [ESC]"
          aria-label="Cerrar glosario"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Loading & Error States */}
      {isLoading && (
        <div className="py-4 text-center text-xs text-zinc-400 flex items-center justify-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-400 animate-spin" />
          <span>Consultando base léxica...</span>
        </div>
      )}

      {error && !isLoading && (
        <div className="py-2 text-xs text-rose-400 text-center font-mono">
          {error}
        </div>
      )}

      {/* Entry Body */}
      {entry && !isLoading && (
        <div className="space-y-2">
          {/* Main Term with Native HTML <ruby> annotations */}
          <div className="flex items-baseline justify-between">
            <div className="text-xl font-bold tracking-wide">
              <ruby className="ruby-cjk">
                {entry.term}
                <rp>(</rp>
                <rt className="text-xs font-normal text-cyan-400 font-mono tracking-tight ml-0.5">
                  {entry.reading}
                </rt>
                <rp>)</rp>
              </ruby>
            </div>
            {entry.romaji && (
              <span className="text-[11px] text-zinc-400 font-mono italic">
                {entry.romaji}
              </span>
            )}
          </div>

          {/* Definition in Spanish */}
          <p className="text-xs text-zinc-200 leading-relaxed font-sans pt-1">
            {entry.definitionEs}
          </p>

          {/* English definition fallback if available */}
          {entry.definitionEn && (
            <p className="text-[11px] text-zinc-400 italic leading-snug">
              {entry.definitionEn}
            </p>
          )}

          {/* Footer Metadata */}
          <div className="flex items-center justify-between pt-1.5 border-t border-zinc-800 text-[10px] text-zinc-500">
            <span>{entry.seriesId ? 'Lore Específico de Serie' : 'Vocabulario General Manga/Manhwa'}</span>
            <kbd className="px-1 py-0.2 bg-zinc-800 border border-zinc-700 rounded text-zinc-400">
              ESC
            </kbd>
          </div>
        </div>
      )}
    </div>
  );
};
