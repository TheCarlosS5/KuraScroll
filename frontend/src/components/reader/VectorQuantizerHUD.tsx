/**
 * KuraScroll - Sprint 100: Century Jubilee - Vector Quantizer & Lore Cross-Referencing HUD
 * 
 * Hardware-tuned for Intel Pentium T4500 & Intel GMA 4500MHD.
 * Displays real-time cosine similarity matching, embedding memory footprint, and chapter-based spoiler shielding.
 * Solid #18181b containment, 0 blur, 0 CLS.
 */

import React from 'react';
import {
  IndexMode,
  VECTOR_INDEX_PRESETS,
} from '../../reader/useVectorQuantizer';

export interface VectorQuantizerHUDProps {
  isVisible: boolean;
  onClose: () => void;
  mode: IndexMode;
  onModeChange: (mode: IndexMode) => void;
  embeddingDimension: number;
  onEmbeddingDimensionChange: (val: number) => void;
  similarityThreshold: number;
  onSimilarityThresholdChange: (val: number) => void;
  maxTopK: number;
  onMaxTopKChange: (val: number) => void;
  isSpoilerShieldActive: boolean;
  onToggleSpoilerShield: () => void;
  candidateRevealChapter: number;
  userCurrentChapter: number;
  onUserCurrentChapterChange?: (val: number) => void;
  cosineSimilarity: number;
  isMatch: boolean;
  isSpoilerShielded: boolean;
  similarityPct: number;
  radarBarColor: string;
  isEnabled: boolean;
  onToggleEnabled: () => void;
}

export const VectorQuantizerHUD: React.FC<VectorQuantizerHUDProps> = ({
  isVisible,
  onClose,
  mode,
  onModeChange,
  embeddingDimension,
  onEmbeddingDimensionChange,
  similarityThreshold,
  onSimilarityThresholdChange,
  maxTopK,
  onMaxTopKChange,
  isSpoilerShieldActive,
  onToggleSpoilerShield,
  candidateRevealChapter,
  userCurrentChapter,
  onUserCurrentChapterChange,
  cosineSimilarity,
  isMatch,
  isSpoilerShielded,
  similarityPct,
  radarBarColor,
  isEnabled,
  onToggleEnabled,
}) => {
  if (!isVisible) return null;

  const estimatedMemoryKb = Math.round((10000 * embeddingDimension) / 1024);

  return (
    <div
      role="region"
      aria-label="Vector Quantizer HUD"
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        width: '370px',
        backgroundColor: '#18181b', // Solid containment for GMA 4500MHD
        border: '1px solid #27272a',
        borderRadius: '8px',
        color: '#f4f4f5',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        fontSize: '12px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
        zIndex: 9999,
        padding: '16px',
        boxSizing: 'border-box',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid #27272a',
          paddingBottom: '10px',
          marginBottom: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              display: 'inline-block',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: isEnabled ? '#10b981' : '#71717a',
            }}
          />
          <span style={{ fontWeight: 600, color: '#fafafa', fontSize: '13px' }}>
            Vector Search & Spoiler Shield
          </span>
          <span
            style={{
              fontSize: '10px',
              backgroundColor: '#27272a',
              color: '#a1a1aa',
              padding: '2px 6px',
              borderRadius: '4px',
            }}
          >
            [Q]
          </span>
        </div>
        <button
          onClick={onClose}
          aria-label="Close HUD"
          style={{
            background: 'none',
            border: 'none',
            color: '#a1a1aa',
            cursor: 'pointer',
            fontSize: '16px',
            padding: '2px 6px',
            borderRadius: '4px',
          }}
        >
          ×
        </button>
      </div>

      {/* Preset Selector */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ fontSize: '11px', color: '#a1a1aa', marginBottom: '6px' }}>
          INDEX QUANTIZATION PROFILE
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          {(Object.keys(VECTOR_INDEX_PRESETS) as IndexMode[]).map((pKey) => {
            const isSelected = mode === pKey;
            return (
              <button
                key={pKey}
                onClick={() => onModeChange(pKey)}
                style={{
                  padding: '6px 8px',
                  backgroundColor: isSelected ? '#3f3f46' : '#27272a',
                  color: isSelected ? '#38bdf8' : '#d4d4d8',
                  border: isSelected ? '1px solid #0284c7' : '1px solid transparent',
                  borderRadius: '4px',
                  fontSize: '11px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {pKey === 'int8_quantized' && '🔢 Int8 Quantized'}
                {pKey === 'compact_scalar' && '📦 Compact 32d'}
                {pKey === 'exact_cosine' && '🎯 Exact 128d'}
                {pKey === 'custom' && '⚙️ Custom'}
              </button>
            );
          })}
        </div>
      </div>

      {/* Semantic Radar & Spoiler Shield Status Bar */}
      <div
        style={{
          marginBottom: '14px',
          padding: '10px',
          backgroundColor: '#09090b',
          borderRadius: '6px',
          border: '1px solid #27272a',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ fontSize: '10px', color: '#a1a1aa' }}>COSINE SIMILARITY RADAR</span>
          <span
            style={{
              fontSize: '10px',
              color: isSpoilerShielded ? '#f59e0b' : (isMatch ? '#10b981' : '#71717a'),
              fontWeight: 600,
            }}
          >
            {isSpoilerShielded ? '🛡️ SPOILER SHIELDED' : (isMatch ? '✓ LORE REVEALED' : 'NO MATCH')}
          </span>
        </div>

        {/* Progress Bar Container */}
        <div
          style={{
            height: '10px',
            backgroundColor: '#27272a',
            borderRadius: '5px',
            overflow: 'hidden',
            marginBottom: '6px',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${similarityPct}%`,
              backgroundColor: radarBarColor,
              transition: 'width 0.2s ease, background-color 0.2s ease',
            }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#71717a' }}>
          <span>Score: <strong style={{ color: '#fafafa' }}>{cosineSimilarity.toFixed(4)}</strong> ({similarityPct}%)</span>
          <span>Chapter: Ch.{userCurrentChapter} (Lore: Ch.{candidateRevealChapter})</span>
        </div>
      </div>

      {/* Sliders */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
        {/* Similarity Threshold */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ color: '#d4d4d8' }}>Similarity Threshold:</span>
            <span style={{ color: '#38bdf8' }}>{similarityThreshold.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="10"
            max="99"
            value={Math.round(similarityThreshold * 100)}
            onChange={(e) => onSimilarityThresholdChange(Number(e.target.value) / 100)}
            style={{ width: '100%', accentColor: '#0284c7', cursor: 'pointer' }}
          />
        </div>

        {/* Embedding Dimension */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ color: '#d4d4d8' }}>Embedding Dimensions:</span>
            <span style={{ color: '#38bdf8' }}>{embeddingDimension} dim</span>
          </div>
          <input
            type="range"
            min="16"
            max="256"
            step="16"
            value={embeddingDimension}
            onChange={(e) => onEmbeddingDimensionChange(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#0284c7', cursor: 'pointer' }}
          />
        </div>

        {/* Max Top K */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ color: '#d4d4d8' }}>Max Top-K Matches:</span>
            <span style={{ color: '#38bdf8' }}>{maxTopK}</span>
          </div>
          <input
            type="range"
            min="1"
            max="50"
            value={maxTopK}
            onChange={(e) => onMaxTopKChange(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#0284c7', cursor: 'pointer' }}
          />
        </div>
      </div>

      {/* Toggles */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#d4d4d8' }}>Chapter Spoiler Shield:</span>
          <button
            onClick={onToggleSpoilerShield}
            style={{
              padding: '3px 8px',
              backgroundColor: isSpoilerShieldActive ? '#0369a1' : '#27272a',
              color: isSpoilerShieldActive ? '#e0f2fe' : '#a1a1aa',
              border: 'none',
              borderRadius: '4px',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            {isSpoilerShieldActive ? 'ACTIVE' : 'OFF'}
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#d4d4d8' }}>Vector Engine:</span>
          <button
            onClick={onToggleEnabled}
            style={{
              padding: '3px 8px',
              backgroundColor: isEnabled ? '#059669' : '#27272a',
              color: isEnabled ? '#ecfdf5' : '#a1a1aa',
              border: 'none',
              borderRadius: '4px',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            {isEnabled ? 'ACTIVE' : 'BYPASS'}
          </button>
        </div>
      </div>

      {/* Telemetry Footer */}
      <div
        style={{
          borderTop: '1px solid #27272a',
          paddingTop: '10px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '6px',
          fontSize: '10px',
          color: '#71717a',
        }}
      >
        <div>Similarity: <span style={{ color: '#a1a1aa' }}>{cosineSimilarity.toFixed(4)}</span></div>
        <div>RAM (10k vec): <span style={{ color: '#a1a1aa' }}>~{estimatedMemoryKb} KB</span></div>
        <div>Top-K Limit: <span style={{ color: '#a1a1aa' }}>{maxTopK}</span></div>
        <div>Status: <span style={{ color: isSpoilerShielded ? '#f59e0b' : (isMatch ? '#10b981' : '#71717a') }}>{isSpoilerShielded ? 'SHIELDED' : (isMatch ? 'MATCH' : 'IDLE')}</span></div>
      </div>
    </div>
  );
};
