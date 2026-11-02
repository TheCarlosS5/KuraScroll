/**
 * KuraScroll Saccadic Glance & Panel Magnifier Loupe HUD
 * Sprint 78 - Optical Loupe & Sub-Panel Zoom Reticle
 *
 * Hardware-tuned for Intel Pentium T4500 & Intel GMA 4500MHD:
 * Pure solid background (#18181b), 0 CLS, zero CSS backdrop-filter blur.
 */

import React, { useEffect } from 'react';
import { LoupeShape } from '../../reader/useMagnifierLoupe';

export interface MagnifierLoupeHUDProps {
  isOpen: boolean;
  onClose: () => void;
  isEnabled: boolean;
  shape: LoupeShape;
  zoomFactor: number;
  lensRadiusPx: number;
  smoothingFactor: number;
  borderColor: string;
  onToggleEnabled: () => void;
  onChangeShape: (shape: LoupeShape) => void;
  onChangeZoomFactor: (zoom: number) => void;
  onChangeLensRadiusPx: (radius: number) => void;
  onChangeSmoothingFactor: (smoothing: number) => void;
  onChangeBorderColor: (color: string) => void;
  onResetToDefaults: () => void;
}

const COLOR_PRESETS = [
  { id: '#3b82f6', label: 'Azul Eléctrico' },
  { id: '#06b6d4', label: 'Cian Neón' },
  { id: '#10b981', label: 'Verde Esmeralda' },
  { id: '#f59e0b', label: 'Ámbar Cálido' },
  { id: '#ffffff', label: 'Blanco Puro' },
];

export const MagnifierLoupeHUD: React.FC<MagnifierLoupeHUDProps> = ({
  isOpen,
  onClose,
  isEnabled,
  shape,
  zoomFactor,
  lensRadiusPx,
  smoothingFactor,
  borderColor,
  onToggleEnabled,
  onChangeShape,
  onChangeZoomFactor,
  onChangeLensRadiusPx,
  onChangeSmoothingFactor,
  onChangeBorderColor,
  onResetToDefaults,
}) => {
  // ESC and 'Z' key listener to close HUD
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA'].includes(target.tagName)) return;

      if ((e.key === 'Escape' || e.key.toLowerCase() === 'z') && isOpen) {
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
      aria-label="Controles de Lupa Óptica y Aumento Sub-Panel"
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
          <span style={{ fontSize: '18px' }}>🔍</span>
          <span style={{ fontWeight: 600, fontSize: '14px' }}>
            Lupa Óptica &amp; Retícula
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
            [Z]
          </span>
        </div>
        <button
          onClick={onClose}
          aria-label="Cerrar panel de lupa"
          style={{
            background: 'none',
            border: 'none',
            color: '#a1a1aa',
            cursor: 'pointer',
            fontSize: '16px',
            lineHeight: 1,
            padding: '4px',
          }}
        >
          ✕
        </button>
      </div>

      {/* Main Switch */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#27272a',
          padding: '8px 12px',
          borderRadius: '6px',
          marginBottom: '14px',
        }}
      >
        <span style={{ fontSize: '13px', fontWeight: 500 }}>Lupa Activa</span>
        <button
          onClick={onToggleEnabled}
          aria-pressed={isEnabled}
          style={{
            backgroundColor: isEnabled ? '#22c55e' : '#3f3f46',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            padding: '4px 10px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {isEnabled ? 'ACTIVADO' : 'DESACTIVADO'}
        </button>
      </div>

      {/* Shape Selector */}
      <div style={{ marginBottom: '14px' }}>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase',
            color: '#a1a1aa',
            marginBottom: '6px',
          }}
        >
          Geometría de la Lente
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => onChangeShape('circle')}
            style={{
              flex: 1,
              backgroundColor: shape === 'circle' ? '#3b82f6' : '#27272a',
              color: shape === 'circle' ? '#fff' : '#d4d4d8',
              border: shape === 'circle' ? '1px solid #60a5fa' : '1px solid transparent',
              borderRadius: '6px',
              padding: '6px 10px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Lente Circular
          </button>
          <button
            onClick={() => onChangeShape('rectangle')}
            style={{
              flex: 1,
              backgroundColor: shape === 'rectangle' ? '#3b82f6' : '#27272a',
              color: shape === 'rectangle' ? '#fff' : '#d4d4d8',
              border: shape === 'rectangle' ? '1px solid #60a5fa' : '1px solid transparent',
              borderRadius: '6px',
              padding: '6px 10px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Retícula Rectangular
          </button>
        </div>
      </div>

      {/* Parameter Sliders */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
        {/* Zoom Factor */}
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '12px',
              marginBottom: '4px',
            }}
          >
            <span style={{ color: '#d4d4d8' }}>Factor de Aumento</span>
            <span style={{ color: '#60a5fa', fontWeight: 600 }}>{zoomFactor.toFixed(2)}x</span>
          </div>
          <input
            type="range"
            min={1.25}
            max={4.0}
            step={0.25}
            value={zoomFactor}
            aria-label="Factor de Aumento"
            onChange={(e) => onChangeZoomFactor(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: '#3b82f6', cursor: 'pointer' }}
          />
        </div>

        {/* Lens Radius */}
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '12px',
              marginBottom: '4px',
            }}
          >
            <span style={{ color: '#d4d4d8' }}>Radio de la Lente</span>
            <span style={{ color: '#60a5fa', fontWeight: 600 }}>{lensRadiusPx} px</span>
          </div>
          <input
            type="range"
            min={60}
            max={250}
            step={10}
            value={lensRadiusPx}
            aria-label="Radio de la Lente"
            onChange={(e) => onChangeLensRadiusPx(parseInt(e.target.value, 10))}
            style={{ width: '100%', accentColor: '#3b82f6', cursor: 'pointer' }}
          />
        </div>

        {/* Smoothing Factor */}
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '12px',
              marginBottom: '4px',
            }}
          >
            <span style={{ color: '#d4d4d8' }}>Amortiguación Sacádica (LERP)</span>
            <span style={{ color: '#60a5fa', fontWeight: 600 }}>
              {Math.round(smoothingFactor * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={0.5}
            step={0.05}
            value={smoothingFactor}
            aria-label="Amortiguación Sacádica"
            onChange={(e) => onChangeSmoothingFactor(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: '#3b82f6', cursor: 'pointer' }}
          />
        </div>

        {/* Border Color */}
        <div>
          <div
            style={{
              fontSize: '12px',
              color: '#d4d4d8',
              marginBottom: '6px',
            }}
          >
            Color del Anillo de la Lente
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {COLOR_PRESETS.map((c) => (
              <button
                key={c.id}
                onClick={() => onChangeBorderColor(c.id)}
                title={c.label}
                aria-label={c.label}
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  backgroundColor: c.id,
                  border: borderColor === c.id ? '2px solid #fff' : '1px solid #3f3f46',
                  cursor: 'pointer',
                  padding: 0,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
        <button
          onClick={onResetToDefaults}
          style={{
            backgroundColor: '#27272a',
            color: '#d4d4d8',
            border: '1px solid #3f3f46',
            borderRadius: '4px',
            padding: '6px 12px',
            fontSize: '12px',
            cursor: 'pointer',
          }}
        >
          Restaurar Predeterminado
        </button>
      </div>
    </div>
  );
};
