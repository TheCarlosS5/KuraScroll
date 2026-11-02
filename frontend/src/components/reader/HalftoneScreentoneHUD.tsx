/**
 * KuraScroll Dynamic Halftone Screentone & Vintage Paper Aging HUD
 * Sprint 77 - Manga Screentone & Tankōbon Aging Simulator
 *
 * Hardware-tuned for Intel Pentium T4500 & Intel GMA 4500MHD:
 * Pure solid background (#18181b), 0 CLS, zero CSS backdrop-filter blur.
 */

import React, { useEffect } from 'react';
import { HalftonePresetName } from '../../reader/useHalftoneScreentone';

export interface HalftoneScreentoneHUDProps {
  isOpen: boolean;
  onClose: () => void;
  isEnabled: boolean;
  presetName: HalftonePresetName;
  dotPitchLpi: number;
  dotAngleDeg: number;
  dotIntensity: number;
  paperAgePct: number;
  foxingIntensity: number;
  onToggleEnabled: () => void;
  onSelectPreset: (preset: HalftonePresetName) => void;
  onChangeDotPitchLpi: (lpi: number) => void;
  onChangeDotAngleDeg: (deg: number) => void;
  onChangeDotIntensity: (val: number) => void;
  onChangePaperAgePct: (val: number) => void;
  onChangeFoxingIntensity: (val: number) => void;
  onResetToDefaults: () => void;
}

const PRESET_OPTIONS: { id: HalftonePresetName; label: string; desc: string }[] = [
  { id: 'pristine', label: 'Pristina', desc: 'Scan digital nítido sin envejecimiento' },
  { id: 'shonen_90s', label: 'Shōnen 90s', desc: 'Trama screentone ligera de revista' },
  { id: 'tankobon_retro', label: 'Tankōbon', desc: 'Trama densa y papel sepia retro' },
  { id: 'pulp_press', label: 'Prensa Pulpa', desc: 'Papel amarillento y foxing vintage' },
];

export const HalftoneScreentoneHUD: React.FC<HalftoneScreentoneHUDProps> = ({
  isOpen,
  onClose,
  isEnabled,
  presetName,
  dotPitchLpi,
  dotAngleDeg,
  dotIntensity,
  paperAgePct,
  foxingIntensity,
  onToggleEnabled,
  onSelectPreset,
  onChangeDotPitchLpi,
  onChangeDotAngleDeg,
  onChangeDotIntensity,
  onChangePaperAgePct,
  onChangeFoxingIntensity,
  onResetToDefaults,
}) => {
  // ESC and 'H' key listener to close HUD
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA'].includes(target.tagName)) return;

      if ((e.key === 'Escape' || e.key.toLowerCase() === 'h') && isOpen) {
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
      aria-label="Controles de Trama Halftone y Envejecimiento de Papel"
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
          <span style={{ fontSize: '18px' }}>📰</span>
          <span style={{ fontWeight: 600, fontSize: '14px' }}>
            Trama Halftone &amp; Papel Retro
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
            [H]
          </span>
        </div>
        <button
          onClick={onClose}
          aria-label="Cerrar panel de halftone"
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
        <span style={{ fontSize: '13px', fontWeight: 500 }}>Simulación Activa</span>
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

      {/* Presets Grid */}
      <div style={{ marginBottom: '16px' }}>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase',
            color: '#a1a1aa',
            marginBottom: '8px',
          }}
        >
          Ajustes Preestablecidos
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '6px',
          }}
        >
          {PRESET_OPTIONS.map((opt) => {
            const isSelected = presetName === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => onSelectPreset(opt.id)}
                title={opt.desc}
                style={{
                  backgroundColor: isSelected ? '#3b82f6' : '#27272a',
                  color: isSelected ? '#ffffff' : '#d4d4d8',
                  border: isSelected ? '1px solid #60a5fa' : '1px solid transparent',
                  borderRadius: '6px',
                  padding: '8px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                }}
              >
                <span style={{ fontSize: '12px', fontWeight: 600 }}>{opt.label}</span>
                <span
                  style={{
                    fontSize: '10px',
                    color: isSelected ? '#e0f2fe' : '#a1a1aa',
                    lineHeight: 1.2,
                  }}
                >
                  {opt.desc}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Parameter Sliders */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
        {/* LPI Pitch */}
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '12px',
              marginBottom: '4px',
            }}
          >
            <span style={{ color: '#d4d4d8' }}>Resolución Trama (LPI)</span>
            <span style={{ color: '#60a5fa', fontWeight: 600 }}>{dotPitchLpi} LPI</span>
          </div>
          <input
            type="range"
            min={20}
            max={150}
            step={5}
            value={dotPitchLpi}
            aria-label="Resolución Trama LPI"
            onChange={(e) => onChangeDotPitchLpi(parseInt(e.target.value, 10))}
            style={{ width: '100%', accentColor: '#3b82f6', cursor: 'pointer' }}
          />
        </div>

        {/* Dot Angle */}
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '12px',
              marginBottom: '4px',
            }}
          >
            <span style={{ color: '#d4d4d8' }}>Ángulo de Matriz</span>
            <span style={{ color: '#60a5fa', fontWeight: 600 }}>{dotAngleDeg.toFixed(1)}°</span>
          </div>
          <input
            type="range"
            min={0}
            max={90}
            step={5}
            value={dotAngleDeg}
            aria-label="Ángulo de Matriz"
            onChange={(e) => onChangeDotAngleDeg(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: '#3b82f6', cursor: 'pointer' }}
          />
        </div>

        {/* Dot Intensity */}
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '12px',
              marginBottom: '4px',
            }}
          >
            <span style={{ color: '#d4d4d8' }}>Intensidad de Trama</span>
            <span style={{ color: '#60a5fa', fontWeight: 600 }}>
              {Math.round(dotIntensity * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={dotIntensity}
            aria-label="Intensidad de Trama"
            onChange={(e) => onChangeDotIntensity(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: '#3b82f6', cursor: 'pointer' }}
          />
        </div>

        {/* Paper Aging */}
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '12px',
              marginBottom: '4px',
            }}
          >
            <span style={{ color: '#d4d4d8' }}>Envejecimiento de Papel</span>
            <span style={{ color: '#eab308', fontWeight: 600 }}>
              {Math.round(paperAgePct * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={paperAgePct}
            aria-label="Envejecimiento de Papel"
            onChange={(e) => onChangePaperAgePct(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: '#eab308', cursor: 'pointer' }}
          />
        </div>

        {/* Foxing Intensity */}
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '12px',
              marginBottom: '4px',
            }}
          >
            <span style={{ color: '#d4d4d8' }}>Manchas Foxing</span>
            <span style={{ color: '#f97316', fontWeight: 600 }}>
              {Math.round(foxingIntensity * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={foxingIntensity}
            aria-label="Manchas Foxing"
            onChange={(e) => onChangeFoxingIntensity(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: '#f97316', cursor: 'pointer' }}
          />
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
