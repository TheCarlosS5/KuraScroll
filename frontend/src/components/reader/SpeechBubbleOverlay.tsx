/**
 * KuraScroll Speech Bubble Multilingual Overlay Component
 * Sprint 46 - Multilingual Speech Bubble Overlays & Ruby/Furigana
 * 
 * Hardware-conscious design for Intel GMA 4500MHD GPU:
 * - Pure solid and linear alpha rendering (0 blur, 0 backdrop-filter)
 * - 0 CLS: Absolute layout overlay percentage-anchored to the source image
 * - Standard HTML5 <ruby> and <rt> markup for Japanese/CJK phonetics
 * - Mode toggle: Furigana / Raw / Español / English / Off
 */

import React, { useState } from 'react';
import { Languages, Eye, EyeOff, BookOpen } from 'lucide-react';

export type OverlayLanguageMode = 'furigana' | 'raw' | 'es' | 'en' | 'off';

export interface RubySegment {
  base: string;
  ruby: string | null;
}

export interface SpeechBubbleBBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SpeechBubbleRecord {
  id: string;
  index: number;
  bbox: SpeechBubbleBBox;
  readingDirection: 'vertical' | 'horizontal';
  rawText: string;
  translations: {
    es?: string;
    en?: string;
  };
  ruby?: RubySegment[];
  confidence: number;
}

export interface SpeechBubbleOverlayProps {
  bubbles: SpeechBubbleRecord[];
  mode?: OverlayLanguageMode;
  opacity?: number;
  onSelectBubble?: (bubble: SpeechBubbleRecord) => void;
  showModeSelector?: boolean;
  onModeChange?: (mode: OverlayLanguageMode) => void;
}

export const SpeechBubbleOverlay: React.FC<SpeechBubbleOverlayProps> = ({
  bubbles,
  mode: controlledMode,
  opacity = 0.92,
  onSelectBubble,
  showModeSelector = false,
  onModeChange
}) => {
  const [internalMode, setInternalMode] = useState<OverlayLanguageMode>('furigana');
  const activeMode = controlledMode ?? internalMode;

  const handleModeChange = (newMode: OverlayLanguageMode) => {
    setInternalMode(newMode);
    if (onModeChange) {
      onModeChange(newMode);
    }
  };

  if (activeMode === 'off' && !showModeSelector) {
    return null;
  }

  return (
    <div
      data-testid="speech-bubble-overlay"
      className="absolute inset-0 pointer-events-none select-none overflow-hidden font-sans z-30"
    >
      {/* Optional Mode Selector Controls (top-left or inside reader bar) */}
      {showModeSelector && (
        <div
          data-testid="bubble-mode-selector"
          className="absolute top-2 left-2 pointer-events-auto bg-zinc-950/90 border border-zinc-700 rounded-md p-1 flex items-center gap-1 shadow-lg z-40 text-xs"
        >
          <Languages size={14} className="text-cyan-400 ml-1" />
          <button
            type="button"
            data-testid="mode-furigana"
            onClick={() => handleModeChange('furigana')}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
              activeMode === 'furigana'
                ? 'bg-cyan-600 text-white font-bold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Furigana
          </button>
          <button
            type="button"
            data-testid="mode-es"
            onClick={() => handleModeChange('es')}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
              activeMode === 'es'
                ? 'bg-cyan-600 text-white font-bold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            ES
          </button>
          <button
            type="button"
            data-testid="mode-raw"
            onClick={() => handleModeChange('raw')}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
              activeMode === 'raw'
                ? 'bg-cyan-600 text-white font-bold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Raw
          </button>
          <button
            type="button"
            data-testid="mode-off"
            onClick={() => handleModeChange('off')}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
              activeMode === 'off'
                ? 'bg-red-900/80 text-red-200 font-bold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Off
          </button>
        </div>
      )}

      {/* Render Dialogue Bubble Overlays */}
      {activeMode !== 'off' &&
        bubbles.map((bubble) => {
          const isVertical = bubble.readingDirection === 'vertical';

          return (
            <div
              key={bubble.id}
              data-testid={`bubble-box-${bubble.id}`}
              onClick={() => onSelectBubble && onSelectBubble(bubble)}
              style={{
                left: `${bubble.bbox.x}%`,
                top: `${bubble.bbox.y}%`,
                width: `${bubble.bbox.width}%`,
                height: `${bubble.bbox.height}%`,
                backgroundColor: `rgba(10, 15, 25, ${opacity})`
              }}
              className="absolute pointer-events-auto rounded border border-cyan-500/30 text-zinc-100 flex items-center justify-center p-1 cursor-pointer transition-transform hover:scale-[1.02] hover:border-cyan-400 shadow-md overflow-hidden"
              title={`Dialogue bubble (${bubble.confidence * 100}% confidence)`}
            >
              <div
                style={{
                  writingMode: isVertical ? 'vertical-rl' : 'horizontal-tb',
                  textOrientation: isVertical ? 'upright' : 'mixed'
                }}
                className="text-xs font-semibold leading-tight flex items-center justify-center text-center max-h-full max-w-full overflow-hidden"
              >
                {/* Furigana Mode */}
                {activeMode === 'furigana' && bubble.ruby && bubble.ruby.length > 0 ? (
                  <span className="flex flex-col items-center">
                    {bubble.ruby.map((seg, idx) => (
                      <ruby key={idx} className="inline-flex flex-col items-center">
                        <span className="text-zinc-100">{seg.base}</span>
                        {seg.ruby && (
                          <rt className="text-[10px] text-cyan-300 font-normal leading-none mb-0.5 select-none">
                            {seg.ruby}
                          </rt>
                        )}
                      </ruby>
                    ))}
                  </span>
                ) : activeMode === 'es' && bubble.translations.es ? (
                  <span className="text-emerald-300">{bubble.translations.es}</span>
                ) : activeMode === 'en' && bubble.translations.en ? (
                  <span className="text-sky-300">{bubble.translations.en}</span>
                ) : (
                  <span className="text-zinc-200">{bubble.rawText}</span>
                )}
              </div>
            </div>
          );
        })}
    </div>
  );
};
