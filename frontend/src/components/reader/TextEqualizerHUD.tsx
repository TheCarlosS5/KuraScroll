/**
 * KuraScroll - Sprint 97: Adaptive Dynamic Range In-Viewport Text & Kanji Edge Equalizer HUD
 * 
 * Hardware-tuned for Intel Pentium T4500 & Intel GMA 4500MHD.
 * Displays real-time black level boost, white level compression, and kanji edge clarity factors.
 * Solid #18181b containment, 0 blur, 0 CLS.
 */

import React from 'react';
import {
  EqualizerMode,
  TEXT_EQUALIZER_PRESETS,
} from '../../reader/useTextEqualizer';

export interface TextEqualizerHUDProps {
  isVisible: boolean;
  onClose: () => void;
  mode: EqualizerMode;
  onModeChange: (mode: EqualizerMode) => void;
  blackLevelBoost: number;
  onBlackLevelBoostChange: (val: number) => void;
  whiteLevelCompression: number;
  onWhiteLevelCompressionChange: (val: number) => void;
  kanjiClarityFactor: number;
  onKanjiClarityFactorChange: (val: number) => void;
  isFuriganaSharpenEnabled: boolean;
  onToggleFuriganaSharpen: () => void;
  effectiveContrast: number;
  effectiveBrightness: number;
  effectiveGamma: number;
  edgeSharpenPx: number;
  compositeFilterCss: string;
  subpixelMatrixCss: string;
  isHighDensityBoostActive: boolean;
  isEnabled: boolean;
  onToggleEnabled: () => void;
}

export const TextEqualizerHUD: React.FC<TextEqualizerHUDProps> = ({
  isVisible,
  onClose,
  mode,
  onModeChange,
  blackLevelBoost,
  onBlackLevelBoostChange,
  whiteLevelCompression,
  onWhiteLevelCompressionChange,
  kanjiClarityFactor,
  onKanjiClarityFactorChange,
  isFuriganaSharpenEnabled,
  onToggleFuriganaSharpen,
  effectiveContrast,
  effectiveBrightness,
  effectiveGamma,
  edgeSharpenPx,
  compositeFilterCss,
  subpixelMatrixCss,
  isHighDensityBoostActive,
  isEnabled,
  onToggleEnabled,
}) => {
  if (!isVisible) return null;

  return (
    <div
      role="region"
      aria-label="Text & Kanji Edge Equalizer HUD"
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
            Text & Kanji Equalizer
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
            [E]
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
          PRESET PROFILE
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          {(Object.keys(TEXT_EQUALIZER_PRESETS) as EqualizerMode[]).map((pKey) => {
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
                {pKey === 'newsprint_vintage' && 'Newsprint'}
                {pKey === 'glossy_digital' && 'Glossy'}
                {pKey === 'faded_doujin' && 'Faded Doujin'}
                {pKey === 'custom' && 'Custom'}
              </button>
            );
          })}
        </div>
      </div>

      {/* Real-time Subpixel Kanji & Furigana Visualizer */}
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
          <span style={{ fontSize: '10px', color: '#a1a1aa' }}>RADICAL DENSITY SIMULATOR</span>
          <span
            style={{
              fontSize: '10px',
              color: isHighDensityBoostActive ? '#10b981' : '#71717a',
              fontWeight: 600,
            }}
          >
            {isHighDensityBoostActive ? 'DYNAMIC BOOST ON' : 'STANDARD'}
          </span>
        </div>

        {/* Japanese typography sample rendering with subpixel filter applied */}
        <div
          style={{
            padding: '8px',
            backgroundColor: '#f5f2e9', // Vintage newsprint paper tone
            color: '#111111',
            borderRadius: '4px',
            textAlign: 'center',
            filter: compositeFilterCss,
          }}
        >
          <div style={{ fontSize: '9px', lineHeight: '1', color: '#333333', marginBottom: '2px' }}>
            <ruby>
              鬱<rt style={{ fontSize: '8px' }}>うつ</rt>
              轟<rt style={{ fontSize: '8px' }}>ごう</rt>
              艦<rt style={{ fontSize: '8px' }}>かん</rt>
            </ruby>
          </div>
          <div
            style={{
              fontSize: '13px',
              fontWeight: 700,
              filter: subpixelMatrixCss !== 'none' ? subpixelMatrixCss : undefined,
            }}
          >
            鬱屈する轟沈艦
          </div>
        </div>
      </div>

      {/* Sliders */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
        {/* Black Level Boost */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ color: '#d4d4d8' }}>Black Ink Anchor:</span>
            <span style={{ color: '#38bdf8' }}>+{Math.round(blackLevelBoost * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={Math.round(blackLevelBoost * 100)}
            onChange={(e) => onBlackLevelBoostChange(Number(e.target.value) / 100)}
            style={{ width: '100%', accentColor: '#0284c7', cursor: 'pointer' }}
          />
        </div>

        {/* White Level Compression */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ color: '#d4d4d8' }}>White Paper Whitener:</span>
            <span style={{ color: '#38bdf8' }}>{Math.round(whiteLevelCompression * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={Math.round(whiteLevelCompression * 100)}
            onChange={(e) => onWhiteLevelCompressionChange(Number(e.target.value) / 100)}
            style={{ width: '100%', accentColor: '#0284c7', cursor: 'pointer' }}
          />
        </div>

        {/* Kanji Clarity Factor */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ color: '#d4d4d8' }}>Kanji Clarity Factor:</span>
            <span style={{ color: '#38bdf8' }}>{kanjiClarityFactor.toFixed(2)}x</span>
          </div>
          <input
            type="range"
            min="100"
            max="250"
            value={Math.round(kanjiClarityFactor * 100)}
            onChange={(e) => onKanjiClarityFactorChange(Number(e.target.value) / 100)}
            style={{ width: '100%', accentColor: '#0284c7', cursor: 'pointer' }}
          />
        </div>
      </div>

      {/* Toggles */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#d4d4d8' }}>Furigana Subpixel Sharpen:</span>
          <button
            onClick={onToggleFuriganaSharpen}
            style={{
              padding: '3px 8px',
              backgroundColor: isFuriganaSharpenEnabled ? '#0369a1' : '#27272a',
              color: isFuriganaSharpenEnabled ? '#e0f2fe' : '#a1a1aa',
              border: 'none',
              borderRadius: '4px',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            {isFuriganaSharpenEnabled ? 'ENABLED' : 'DISABLED'}
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#d4d4d8' }}>Equalizer Engine:</span>
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
        <div>Contrast: <span style={{ color: '#a1a1aa' }}>{effectiveContrast.toFixed(2)}x</span></div>
        <div>Brightness: <span style={{ color: '#a1a1aa' }}>{effectiveBrightness.toFixed(2)}x</span></div>
        <div>Gamma: <span style={{ color: '#a1a1aa' }}>{effectiveGamma.toFixed(2)}</span></div>
        <div>Edge Sharpen: <span style={{ color: '#a1a1aa' }}>{edgeSharpenPx.toFixed(2)}px</span></div>
      </div>
    </div>
  );
};
