/**
 * KuraScroll Hybrid Search Match Badge Component
 * Sprint 47 - Semantic Vector Embeddings & Hybrid RRF Search
 * 
 * Hardware-conscious design for Intel GMA 4500MHD GPU:
 * - Pure solid colors and clean borders (0 blur, 0 backdrop-filter)
 * - 0 CLS: Self-contained layout dimensions
 * - Clear otaku discovery badges (Hybrid, Semantic AI, Exact Match)
 */

import React from 'react';
import { Sparkles, Brain, Target } from 'lucide-react';

export type MatchType = 'hybrid' | 'semantic' | 'lexical';

export interface HybridSearchMatchBadgeProps {
  matchType: MatchType;
  similarity?: number;
  rrfScore?: number;
  className?: string;
}

export const HybridSearchMatchBadge: React.FC<HybridSearchMatchBadgeProps> = ({
  matchType,
  similarity,
  rrfScore,
  className = ''
}) => {
  const simPercent = similarity !== undefined ? Math.round(similarity * 100) : undefined;

  if (matchType === 'hybrid') {
    return (
      <span
        data-testid="badge-hybrid"
        title={`Coincidencia dual léxica y semántica (RRF: ${rrfScore?.toFixed(4) || 'N/A'})`}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-violet-950/80 border border-violet-500/50 text-violet-300 shadow-sm ${className}`}
      >
        <Sparkles size={11} className="text-violet-400" />
        <span>Híbrido {simPercent ? `${simPercent}%` : 'IA'}</span>
      </span>
    );
  }

  if (matchType === 'semantic') {
    return (
      <span
        data-testid="badge-semantic"
        title={`Descubrimiento semántico por sinopsis y temas afines (Similitud: ${simPercent || 0}%)`}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-cyan-950/80 border border-cyan-500/50 text-cyan-300 shadow-sm ${className}`}
      >
        <Brain size={11} className="text-cyan-400" />
        <span>Semántico {simPercent ? `${simPercent}%` : ''}</span>
      </span>
    );
  }

  return (
    <span
      data-testid="badge-lexical"
      title="Coincidencia léxica exacta por título o alias FTS5"
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 shadow-sm ${className}`}
    >
      <Target size={11} className="text-emerald-400" />
      <span>Exacto</span>
    </span>
  );
};
