/**
 * KuraScroll Adaptive Ambient Lighting Reactive Backlight HUD
 * Sprint 80 - Dynamic Luminance Normalizer & Circadian Eye Shield
 *
 * Hardware-tuned for Intel Pentium T4500 & Intel GMA 4500MHD:
 * Pure solid background (#18181b), 0 CLS, zero CSS backdrop-filter blur.
 */

import React, { useEffect } from 'react';
import { PaperTintMode, BACKLIGHT_PRESETS } from '../../reader/useAmbientBacklight';

export interface AmbientBacklightHUDProps {
  isOpen: boolean;
  onClose: () => void;
  isEnabled: boolean;
  kelvin: number;
  luminance: number;
  blueLightReduction: number;
  paperTintMode: PaperTintMode;
  circadianAuto: boolean;
  onToggleEnabled: () => void;
  onChangeKelvin: (k: number) => void;
  onChangeLuminance: (l: number) => void;
  onChangeBlueLightReduction: (b: number) => void;
  onChangePaperTintMode: (mode: PaperTintMode) => void;
  onToggleCircadianAuto: (enabled: boolean) => void;
  onResetToDefaults: () => void;
}

export const AmbientBacklightHUD: React.FC<AmbientBacklightHUDProps> = ({
  isOpen,
  onClose,
  isEnabled,
  kelvin,
  luminance,
  blueLightReduction,
  paperTintMode,
  circadianAuto,
  onToggleEnabled,
  onChangeKelvin,
  onChangeLuminance,
  onChangeBlueLightReduction,
  onChangePaperTintMode,
  onToggleCircadianAuto,
  onResetToDefaults,
}) => {
  // ESC and 'L' key listener to close HUD
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA'].includes(target.tagName)) return;

      if ((e.key === 'Escape' || e.key.toLowerCase() === 'l') && isOpen) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const presetsList: PaperTintMode[] = ['neutral', 'warm_amber', 'sunset', 'candlelight', 'e_ink_amber'];

  return (
    <div
      role="dialog"
      aria-label="Controles de Retroiluminación y Escudo Circadiano"
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        width: '390px',
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
            Luz Ambiental &amp; Circadiana
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
            [L]
          </span>
        </div>
        <button
          onClick={onClose}
          aria-label="Cerrar panel de luz ambiental"
          style={{
            background: 'none',
            border: 'none',
            color: '#a1a1aa',
            cursor: 'pointer',
            fontSize: '16px',
            lineHeight: 1,
            padding: '4px',
          }}
        >&times;</button>
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
          marginBottom: '12px',
        }}
      >
        <span style={{ fontSize: '13px', fontWeight: 500 }}>Filtro de Luz Activo</span>
        <button
          onClick={onToggleEnabled}
          aria-pressed={isEnabled}
          style={{
            backgroundColor: isEnabled ? '#3b82f6' : '#3f3f46',
            color: '#ffffff',
            border: 'none',
            borderRadius: '4px',
            padding: '4px 10px',
            fontSize: '12px',
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          {isEnabled ? 'Activado' : 'Desactivado'}
        </button>
      </div>

      {/* Circadian Auto Switch */}
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
        <div>
          <div style={{ fontSize: '13px', fontWeight: 500 }}>Modo Circadiano Solar</div>
          <div style={{ fontSize: '11px', color: '#a1a1aa' }}>Ajusta Kelvin automáticamente según la hora</div>
        </div>
        <button
          onClick={() => onToggleCircadianAuto(!circadianAuto)}
          aria-pressed={circadianAuto}
          style={{
            backgroundColor: circadianAuto ? '#10b981' : '#3f3f46',
            color: '#ffffff',
            border: 'none',
            borderRadius: '4px',
            padding: '4px 10px',
            fontSize: '12px',
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          {circadianAuto ? 'Auto ON' : 'Manual'}
        </button>
      </div>

      {/* Presets Grid */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ fontSize: '12px', color: '#a1a1aa', marginBottom: '6px' }}>
          Perfiles Ópticos
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
          {presetsList.map((mode) => {
            const p = BACKLIGHT_PRESETS[mode];
            const isSelected = paperTintMode === mode && !circadianAuto;
            return (
              <button
                key={mode}
                onClick={() => onChangePaperTintMode(mode)}
                style={{
                  backgroundColor: isSelected ? '#3b82f6' : '#27272a',
                  color: isSelected ? '#ffffff' : '#d4d4d8',
                  border: isSelected ? '1px solid #60a5fa' : '1px solid #3f3f46',
                  borderRadius: '4px',
                  padding: '6px 4px',
                  fontSize: '11px',
                  cursor: 'pointer',
                  textAlign: 'center',
                  fontWeight: isSelected ? 600 : 400,
                }}
              >
                {p.name.split(' (')[0]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Controls Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '14px' }}>
        {/* Kelvin Temperature */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
            <span style={{ color: '#d4d4d8' }}>Temperatura Color</span>
            <span style={{ color: '#38bdf8', fontWeight: 600 }}>{kelvin} K</span>
          </div>
          <input
            type="range"
            min={1800}
            max={6500}
            step={50}
            value={kelvin}
            disabled={circadianAuto}
            onChange={(e) => onChangeKelvin(Number(e.target.value))}
            aria-label="Temperatura de color en grados Kelvin"
            style={{ width: '100%', accentColor: '#38bdf8', cursor: circadianAuto ? 'not-allowed' : 'pointer' }}
          />
        </div>

        {/* Luminance Target */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
            <span style={{ color: '#d4d4d8' }}>Luminosidad</span>
            <span style={{ color: '#facc15', fontWeight: 600 }}>{Math.round(luminance * 100)}%</span>
          </div>
          <input
            type="range"
            min={0.3}
            max={1.5}
            step={0.05}
            value={luminance}
            onChange={(e) => onChangeLuminance(Number(e.target.value))}
            aria-label="Nivel de luminosidad"
            style={{ width: '100%', accentColor: '#facc15', cursor: 'pointer' }}
          />
        </div>

        {/* Blue Light Reduction */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
            <span style={{ color: '#d4d4d8' }}>Reducción Luz Azul</span>
            <span style={{ color: '#f97316', fontWeight: 600 }}>{Math.round(blueLightReduction * 100)}%</span>
          </div>
          <input
            type="range"
            min={0.0}
            max={0.8}
            step={0.05}
            value={blueLightReduction}
            onChange={(e) => onChangeBlueLightReduction(Number(e.target.value))}
            aria-label="Porcentaje de reducción de luz azul"
            style={{ width: '100%', accentColor: '#f97316', cursor: 'pointer' }}
          />
        </div>
      </div>

      {/* Swatch & Status Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#27272a',
          padding: '8px 12px',
          borderRadius: '6px',
          marginBottom: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              backgroundColor: kelvin < 3000 ? '#f59e0b' : kelvin < 5000 ? '#fde047' : '#ffffff',
              border: '1px solid #52525b',
            }}
          />
          <span style={{ fontSize: '11px', color: '#a1a1aa' }}>
            {circadianAuto ? 'Solar Activo' : BACKLIGHT_PRESETS[paperTintMode]?.name || 'Personalizado'}
          </span>
        </div>
        <span style={{ fontSize: '11px', color: '#71717a' }}>0ms Latencia</span>
      </div>

      {/* Reset button */}
      <button
        onClick={onResetToDefaults}
        style={{
          width: '100%',
          backgroundColor: 'transparent',
          border: '1px solid #3f3f46',
          color: '#a1a1aa',
          padding: '6px',
          borderRadius: '4px',
          fontSize: '11px',
          cursor: 'pointer',
        }}
      >
        Restablecer Ajustes Predeterminados
      </button>
    </div>
  );
};
