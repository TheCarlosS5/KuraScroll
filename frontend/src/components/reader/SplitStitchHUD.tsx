/**
 * KuraScroll Intelligent Dual-Page Splitter & Webtoon Vertical Stitcher HUD
 * Sprint 76 - Smart Page Auto-Slicer & Continuous Strip Weaver
 *
 * Hardware-tuned for Intel Pentium T4500 & Intel GMA 4500MHD:
 * Pure solid background (#18181b), 0 CLS, zero CSS backdrop-filter blur.
 */

import React, { useEffect } from 'react';
import { SplitStitchMode } from '../../reader/usePageSplitStitch';

export interface SplitStitchHUDProps {
  isOpen: boolean;
  onClose: () => void;
  isEnabled: boolean;
  mode: SplitStitchMode;
  splitRatio: number;
  stitchGapPx: number;
  onToggleEnabled: () => void;
  onChangeMode: (mode: SplitStitchMode) => void;
  onChangeSplitRatio: (ratio: number) => void;
  onChangeStitchGapPx: (gap: number) => void;
  onResetToDefaults: () => void;
}

const MODES: { id: SplitStitchMode; label: string; desc: string }[] = [
  { id: 'none', label: 'Original', desc: 'Sin división ni costura' },
  { id: 'split_rtl', label: 'Dividir RTL', desc: 'Manga japonés (RTL)' },
  { id: 'split_ltr', label: 'Dividir LTR', desc: 'Cómic/Manhwa (LTR)' },
  { id: 'stitch_webtoon', label: 'Coser Webtoon', desc: 'Cinta vertical continua' },
];

export const SplitStitchHUD: React.FC<SplitStitchHUDProps> = ({
  isOpen,
  onClose,
  isEnabled,
  mode,
  splitRatio,
  stitchGapPx,
  onToggleEnabled,
  onChangeMode,
  onChangeSplitRatio,
  onChangeStitchGapPx,
  onResetToDefaults,
}) => {
  // ESC and 'D' key listener to close HUD
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA'].includes(target.tagName)) return;

      if ((e.key === 'Escape' || e.key.toLowerCase() === 'd') && isOpen) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-label="Controles de División y Costura de Páginas"
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        width: '380px',
        backgroundColor: '#18181b',
        border: '1px solid #27272a',
        borderRadius: '8px',
        color: '#f4f4f5',
        padding: '16px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        zIndex: 9999,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          
          <span style={{ fontWeight: 600, fontSize: '14px' }}>
            División &amp; Costura Webtoon
          </span>
          <span
            style={{
              fontSize: '11px',
              backgroundColor: '#27272a',
              color: '#a1a1aa',
              padding: '2px 6px',
              borderRadius: '4px',
            }}
          >
            [D]
          </span>
        </div>
        <button
          onClick={onClose}
          aria-label="Cerrar panel de división"
          style={{
            background: 'none',
            border: 'none',
            color: '#a1a1aa',
            cursor: 'pointer',
            fontSize: '16px',
            padding: '4px',
          }}
        >&times;</button>
      </div>

      {/* Enable Toggle */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
          paddingBottom: '10px',
          borderBottom: '1px solid #27272a',
        }}
      >
        <span style={{ fontSize: '13px', color: '#d4d4d8' }}>
          Transformación de Páginas
        </span>
        <button
          onClick={onToggleEnabled}
          aria-label="Alternar división de páginas"
          style={{
            backgroundColor: isEnabled ? '#2563eb' : '#27272a',
            border: 'none',
            color: '#ffffff',
            borderRadius: '4px',
            padding: '4px 10px',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {isEnabled ? 'Activado' : 'Desactivado'}
        </button>
      </div>

      {/* Mode Selector */}
      <div style={{ marginBottom: '14px' }}>
        <span style={{ fontSize: '12px', color: '#a1a1aa', display: 'block', marginBottom: '8px' }}>
          Modo de Composición
        </span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          {MODES.map((m) => {
            const isSelected = mode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => onChangeMode(m.id)}
                aria-label={m.label}
                style={{
                  backgroundColor: isSelected ? '#2563eb' : '#27272a',
                  border: isSelected ? '1px solid #3b82f6' : '1px solid #3f3f46',
                  color: isSelected ? '#ffffff' : '#d4d4d8',
                  borderRadius: '6px',
                  padding: '8px 10px',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: '12px', fontWeight: 600 }}>{m.label}</div>
                <div style={{ fontSize: '10px', color: isSelected ? '#bfdbfe' : '#71717a' }}>
                  {m.desc}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Conditional Sliders */}
      {mode.startsWith('split_') && (
        <div style={{ marginBottom: '12px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '12px',
              color: '#a1a1aa',
              marginBottom: '4px',
            }}
          >
            <span>Punto de Corte Central</span>
            <span style={{ fontWeight: 600, color: '#f4f4f5' }}>
              {(splitRatio * 100).toFixed(0)}%
            </span>
          </div>
          <input
            type="range"
            min="0.40"
            max="0.60"
            step="0.01"
            value={splitRatio}
            aria-label="Punto de Corte Central"
            onChange={(e) => onChangeSplitRatio(parseFloat(e.target.value))}
            style={{
              width: '100%',
              accentColor: '#2563eb',
              cursor: 'pointer',
            }}
          />
        </div>
      )}

      {mode === 'stitch_webtoon' && (
        <div style={{ marginBottom: '12px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '12px',
              color: '#a1a1aa',
              marginBottom: '4px',
            }}
          >
            <span>Espacio de Costura (Gap)</span>
            <span style={{ fontWeight: 600, color: '#f4f4f5' }}>
              {stitchGapPx}px
            </span>
          </div>
          <input
            type="range"
            min="-2"
            max="16"
            step="1"
            value={stitchGapPx}
            aria-label="Espacio de Costura"
            onChange={(e) => onChangeStitchGapPx(parseInt(e.target.value, 10))}
            style={{
              width: '100%',
              accentColor: '#2563eb',
              cursor: 'pointer',
            }}
          />
        </div>
      )}

      {/* Footer Reset */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          paddingTop: '8px',
          borderTop: '1px solid #27272a',
        }}
      >
        <button
          onClick={onResetToDefaults}
          aria-label="Restablecer valores por defecto"
          style={{
            background: 'none',
            border: 'none',
            color: '#a1a1aa',
            fontSize: '11px',
            cursor: 'pointer',
            textDecoration: 'underline',
          }}
        >
          Restablecer
        </button>
      </div>
    </div>
  );
};
